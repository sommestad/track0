import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

vi.mock('@ai-sdk/gateway', () => ({
  gateway: Object.assign(
    vi.fn(() => 'mock-model'),
    {
      textEmbeddingModel: vi.fn(() => 'mock-embedding-model'),
    },
  ),
}));

vi.mock('../db', () => ({
  ensureSchema: vi.fn(),
  generateIssueId: vi.fn(),
  createIssue: vi.fn(),
  getIssue: vi.fn(),
  updateIssueFields: vi.fn(),
  updateIssueEmbedding: vi.fn(),
  addThreadMessage: vi.fn(),
  getThreadMessages: vi.fn(),
  vectorSearch: vi.fn(),
}));

vi.mock('../ai', () => ({
  extractFields: vi.fn(),
  generateEmbedding: vi.fn(),
}));

import { generateText } from 'ai';
import {
  ensureSchema,
  generateIssueId,
  createIssue,
  getIssue,
  updateIssueFields,
  updateIssueEmbedding,
  addThreadMessage,
  getThreadMessages,
  vectorSearch,
} from '../db';
import { extractFields, generateEmbedding } from '../ai';
import { runTellAgent } from '../tell-agent';
import { createBaseIssue, createBaseIssueFields } from '../test-util';

const mockGenerateText = vi.mocked(generateText);
const mockEnsureSchema = vi.mocked(ensureSchema);
const mockGenerateIssueId = vi.mocked(generateIssueId);
const mockCreateIssue = vi.mocked(createIssue);
const mockGetIssue = vi.mocked(getIssue);
const mockUpdateIssueFields = vi.mocked(updateIssueFields);
const mockUpdateIssueEmbedding = vi.mocked(updateIssueEmbedding);
const mockAddThreadMessage = vi.mocked(addThreadMessage);
const mockGetThreadMessages = vi.mocked(getThreadMessages);
const mockVectorSearch = vi.mocked(vectorSearch);
const mockExtractFields = vi.mocked(extractFields);
const mockGenerateEmbedding = vi.mocked(generateEmbedding);

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsureSchema.mockResolvedValue(undefined);
});

describe('runTellAgent', () => {
  it('should call ensureSchema and generateText', async () => {
    mockGenerateText.mockResolvedValue({ text: 'Created wi_abc' } as never);

    await runTellAgent('Add rate limiting');

    expect(mockEnsureSchema).toHaveBeenCalledOnce();
    expect(mockGenerateText).toHaveBeenCalledOnce();
  });

  it('should return the agent response text', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Created wi_new123: "Add rate limiting"',
    } as never);

    const result = await runTellAgent('Add rate limiting');

    expect(result).toBe('Created wi_new123: "Add rate limiting"');
  });

  it('should include issue_id in prompt when provided', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Updated wi_exist1',
    } as never);

    await runTellAgent('Fixed the bug', 'wi_exist1');

    const call = mockGenerateText.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).toContain('Update issue wi_exist1');
    expect(call.prompt).toContain('Fixed the bug');
  });

  it('should use raw message as prompt when no issue_id', async () => {
    mockGenerateText.mockResolvedValue({ text: 'Created wi_abc' } as never);

    await runTellAgent('Add rate limiting to API');

    const call = mockGenerateText.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).toBe('Add rate limiting to API');
  });

  it('should register four tools', async () => {
    mockGenerateText.mockResolvedValue({ text: 'ok' } as never);

    await runTellAgent('test');

    const call = mockGenerateText.mock.calls[0][0] as {
      tools: Record<string, unknown>;
    };
    expect(Object.keys(call.tools)).toEqual([
      'search_issues',
      'get_issue',
      'create_issue',
      'update_issue',
    ]);
  });

  it('should propagate errors from ensureSchema', async () => {
    mockEnsureSchema.mockRejectedValue(new Error('DB down'));

    await expect(runTellAgent('test')).rejects.toThrow('DB down');
  });
});

describe('tell agent tools', () => {
  async function extractTools() {
    mockGenerateText.mockResolvedValue({ text: 'ok' } as never);
    await runTellAgent('test');
    const call = mockGenerateText.mock.calls[0][0] as {
      tools: Record<
        string,
        { execute: (...args: never[]) => Promise<unknown> }
      >;
    };
    return call.tools;
  }

  describe('search_issues', () => {
    it('should return matching issues with similarity', async () => {
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockVectorSearch.mockResolvedValue([
        { ...createBaseIssue({ id: 'wi_aaa' }), similarity: 0.92 },
      ] as never);

      const tools = await extractTools();
      const result = await tools.search_issues.execute({
        query: 'rate limiting',
      } as never);

      expect(mockGenerateEmbedding).toHaveBeenCalledWith('rate limiting');
      expect(result).toEqual([
        expect.objectContaining({ id: 'wi_aaa', similarity: 92 }),
      ]);
    });

    it('should return empty array when embedding fails', async () => {
      mockGenerateEmbedding.mockResolvedValue(null);

      const tools = await extractTools();
      const result = await tools.search_issues.execute({
        query: 'test',
      } as never);

      expect(result).toEqual([]);
      expect(mockVectorSearch).not.toHaveBeenCalled();
    });
  });

  describe('get_issue', () => {
    it('should return issue with recent messages', async () => {
      const issue = createBaseIssue({ id: 'wi_get1' });
      mockGetIssue.mockResolvedValue(issue);
      mockGetThreadMessages.mockResolvedValue([]);

      const tools = await extractTools();
      const result = await tools.get_issue.execute({
        id: 'wi_get1',
      } as never);

      expect(result).toEqual({ issue, recent_messages: [] });
    });

    it('should return error when issue not found', async () => {
      mockGetIssue.mockResolvedValue(null);

      const tools = await extractTools();
      const result = await tools.get_issue.execute({
        id: 'wi_gone',
      } as never);

      expect(result).toEqual({ error: 'Issue not found: wi_gone' });
    });
  });

  describe('create_issue', () => {
    beforeEach(() => {
      mockGenerateIssueId.mockReturnValue('wi_new123');
      mockCreateIssue.mockResolvedValue(undefined);
      mockAddThreadMessage.mockResolvedValue(undefined);
      mockUpdateIssueFields.mockResolvedValue(undefined);
      mockUpdateIssueEmbedding.mockResolvedValue(undefined);
    });

    it('should create issue and return fields', async () => {
      const fields = createBaseIssueFields({
        title: 'Add rate limiting',
        priority: 2,
      });
      mockExtractFields.mockResolvedValue(fields);
      mockGenerateEmbedding.mockResolvedValue([0.1]);

      const tools = await extractTools();
      const result = await tools.create_issue.execute({
        message: 'Add rate limiting to API',
      } as never);

      expect(mockCreateIssue).toHaveBeenCalledWith('wi_new123');
      expect(mockAddThreadMessage).toHaveBeenCalledWith(
        'wi_new123',
        'assistant',
        'Add rate limiting to API',
      );
      expect(mockUpdateIssueFields).toHaveBeenCalledWith('wi_new123', fields);
      expect(result).toEqual(
        expect.objectContaining({
          id: 'wi_new123',
          title: 'Add rate limiting',
          priority: 2,
        }),
      );
    });

    it('should reject P5 issues', async () => {
      mockExtractFields.mockResolvedValue(
        createBaseIssueFields({ priority: 5, title: 'Fix typo' }),
      );

      const tools = await extractTools();
      const result = await tools.create_issue.execute({
        message: 'Fix typo',
      } as never);

      expect(result).toEqual(expect.objectContaining({ rejected: true }));
      expect(mockCreateIssue).not.toHaveBeenCalled();
    });

    it('should return error when extraction fails', async () => {
      mockExtractFields.mockResolvedValue(null);

      const tools = await extractTools();
      const result = await tools.create_issue.execute({
        message: '...',
      } as never);

      expect(result).toEqual({ error: 'Could not extract issue details' });
    });
  });

  describe('update_issue', () => {
    it('should update issue and return new fields', async () => {
      const existing = createBaseIssue({ id: 'wi_upd1' });
      mockGetIssue
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(
          createBaseIssue({ id: 'wi_upd1', title: 'Updated title' }),
        );
      mockAddThreadMessage.mockResolvedValue(undefined);
      mockGetThreadMessages.mockResolvedValue([]);
      mockExtractFields.mockResolvedValue(
        createBaseIssueFields({ title: 'Updated title' }),
      );
      mockGenerateEmbedding.mockResolvedValue([0.1]);
      mockUpdateIssueFields.mockResolvedValue(undefined);
      mockUpdateIssueEmbedding.mockResolvedValue(undefined);

      const tools = await extractTools();
      const result = await tools.update_issue.execute({
        issue_id: 'wi_upd1',
        message: 'Progress update',
      } as never);

      expect(mockAddThreadMessage).toHaveBeenCalledWith(
        'wi_upd1',
        'assistant',
        'Progress update',
      );
      expect(result).toEqual(
        expect.objectContaining({ id: 'wi_upd1', title: 'Updated title' }),
      );
    });

    it('should return error when issue not found', async () => {
      mockGetIssue.mockResolvedValue(null);

      const tools = await extractTools();
      const result = await tools.update_issue.execute({
        issue_id: 'wi_gone',
        message: 'update',
      } as never);

      expect(result).toEqual({ error: 'Issue not found: wi_gone' });
    });
  });
});
