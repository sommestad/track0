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
  getIssue: vi.fn(),
  getThreadMessages: vi.fn(),
  getNonDoneIssues: vi.fn(),
  vectorSearch: vi.fn(),
  queryIssues: vi.fn(),
}));

vi.mock('../ai', () => ({
  generateEmbedding: vi.fn(),
}));

import { generateText } from 'ai';
import {
  ensureSchema,
  getIssue,
  getThreadMessages,
  getNonDoneIssues,
  vectorSearch,
  queryIssues,
} from '../db';
import { generateEmbedding } from '../ai';
import { runAskAgent } from '../ask-agent';
import { createBaseIssue } from '../test-util';

const mockGenerateText = vi.mocked(generateText);
const mockEnsureSchema = vi.mocked(ensureSchema);
const mockGetIssue = vi.mocked(getIssue);
const mockGetThreadMessages = vi.mocked(getThreadMessages);
const mockGetNonDoneIssues = vi.mocked(getNonDoneIssues);
const mockVectorSearch = vi.mocked(vectorSearch);
const mockGenerateEmbedding = vi.mocked(generateEmbedding);
const mockQueryIssues = vi.mocked(queryIssues);

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsureSchema.mockResolvedValue(undefined);
});

describe('runAskAgent', () => {
  it('should call ensureSchema and generateText', async () => {
    mockGenerateText.mockResolvedValue({ text: 'No issues found.' } as never);

    await runAskAgent('What bugs are open?');

    expect(mockEnsureSchema).toHaveBeenCalledOnce();
    expect(mockGenerateText).toHaveBeenCalledOnce();
  });

  it('should return the agent response text', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'There are 2 open bugs: (wi_a) and (wi_b)',
    } as never);

    const result = await runAskAgent('What bugs are open?');

    expect(result).toBe('There are 2 open bugs: (wi_a) and (wi_b)');
  });

  it('should pass the question as prompt', async () => {
    mockGenerateText.mockResolvedValue({ text: 'answer' } as never);

    await runAskAgent('What should I work on next?');

    const call = mockGenerateText.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).toBe('What should I work on next?');
  });

  it('should register four tools', async () => {
    mockGenerateText.mockResolvedValue({ text: 'ok' } as never);

    await runAskAgent('test');

    const call = mockGenerateText.mock.calls[0][0] as {
      tools: Record<string, unknown>;
    };
    expect(Object.keys(call.tools)).toEqual([
      'search_issues',
      'list_active_issues',
      'get_issue',
      'query_issues',
    ]);
  });

  it('should propagate errors from ensureSchema', async () => {
    mockEnsureSchema.mockRejectedValue(new Error('DB down'));

    await expect(runAskAgent('test')).rejects.toThrow('DB down');
  });
});

describe('ask agent tools', () => {
  async function extractTools() {
    mockGenerateText.mockResolvedValue({ text: 'ok' } as never);
    await runAskAgent('test');
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
        { ...createBaseIssue({ id: 'wi_aaa' }), similarity: 0.85 },
      ] as never);

      const tools = await extractTools();
      const result = await tools.search_issues.execute({
        query: 'auth bug',
      } as never);

      expect(mockGenerateEmbedding).toHaveBeenCalledWith('auth bug');
      expect(result).toEqual([
        expect.objectContaining({ id: 'wi_aaa', similarity: 85 }),
      ]);
    });

    it('should return empty array when embedding fails', async () => {
      mockGenerateEmbedding.mockResolvedValue(null);

      const tools = await extractTools();
      const result = await tools.search_issues.execute({
        query: 'test',
      } as never);

      expect(result).toEqual([]);
    });
  });

  describe('list_active_issues', () => {
    it('should return all non-done issues', async () => {
      const issues = [
        createBaseIssue({ id: 'wi_a', status: 'open', priority: 1 }),
        createBaseIssue({ id: 'wi_b', status: 'active', priority: 2 }),
      ];
      mockGetNonDoneIssues.mockResolvedValue(issues);

      const tools = await extractTools();
      const result = await tools.list_active_issues.execute({} as never);

      expect(result).toEqual([
        expect.objectContaining({ id: 'wi_a', status: 'open' }),
        expect.objectContaining({ id: 'wi_b', status: 'active' }),
      ]);
    });
  });

  describe('get_issue', () => {
    it('should return issue with full thread', async () => {
      const issue = createBaseIssue({ id: 'wi_get1' });
      mockGetIssue.mockResolvedValue(issue);
      mockGetThreadMessages.mockResolvedValue([]);

      const tools = await extractTools();
      const result = await tools.get_issue.execute({
        id: 'wi_get1',
      } as never);

      expect(result).toEqual({ issue, messages: [] });
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

  describe('query_issues', () => {
    it('should filter by status', async () => {
      mockQueryIssues.mockResolvedValue([
        {
          id: 'wi_q1',
          title: 'Open bug',
          type: 'bug',
          status: 'open',
          priority: 2,
          labels: [],
          summary: 'A bug',
          last_message_by: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          message_count: 3,
          total_chars: 200,
          last_message_role: 'user',
          last_message_content: 'Still broken',
          last_message_timestamp: '2025-01-01T00:00:00Z',
          similarity: null,
        },
      ]);

      const tools = await extractTools();
      const result = (await tools.query_issues.execute({
        status: 'open',
      } as never)) as { count: number; issues: unknown[] };

      expect(mockQueryIssues).toHaveBeenCalledWith({ status: 'open' });
      expect(result.count).toBe(1);
      expect(result.issues[0]).toEqual(
        expect.objectContaining({ id: 'wi_q1', status: 'open' }),
      );
    });

    it('should filter by array of statuses', async () => {
      mockQueryIssues.mockResolvedValue([]);

      const tools = await extractTools();
      await tools.query_issues.execute({
        status: ['open', 'active'],
      } as never);

      expect(mockQueryIssues).toHaveBeenCalledWith({
        status: ['open', 'active'],
      });
    });

    it('should combine multiple filters', async () => {
      mockQueryIssues.mockResolvedValue([]);

      const tools = await extractTools();
      await tools.query_issues.execute({
        status: 'open',
        type: 'feature',
        last_message_by: 'user',
        max_messages: 3,
      } as never);

      expect(mockQueryIssues).toHaveBeenCalledWith({
        status: 'open',
        type: 'feature',
        last_message_by: 'user',
        max_messages: 3,
      });
    });

    it('should generate embedding for search param', async () => {
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockQueryIssues.mockResolvedValue([]);

      const tools = await extractTools();
      await tools.query_issues.execute({
        status: 'open',
        search: 'authentication',
      } as never);

      expect(mockGenerateEmbedding).toHaveBeenCalledWith('authentication');
      expect(mockQueryIssues).toHaveBeenCalledWith({
        status: 'open',
        search_embedding: [0.1, 0.2, 0.3],
      });
    });

    it('should omit embedding when generation fails', async () => {
      mockGenerateEmbedding.mockResolvedValue(null);
      mockQueryIssues.mockResolvedValue([]);

      const tools = await extractTools();
      await tools.query_issues.execute({
        search: 'broken thing',
      } as never);

      expect(mockQueryIssues).toHaveBeenCalledWith({});
    });

    it('should return all issues when no filters provided', async () => {
      mockQueryIssues.mockResolvedValue([]);

      const tools = await extractTools();
      const result = (await tools.query_issues.execute({} as never)) as {
        count: number;
        issues: unknown[];
      };

      expect(mockQueryIssues).toHaveBeenCalledWith({});
      expect(result.count).toBe(0);
      expect(result.issues).toEqual([]);
    });

    it('should include thread stats and last message in results', async () => {
      mockQueryIssues.mockResolvedValue([
        {
          id: 'wi_q2',
          title: 'Feature req',
          type: 'feature',
          status: 'open',
          priority: 3,
          labels: ['ui'],
          summary: 'A feature',
          last_message_by: 'user',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          message_count: 5,
          total_chars: 1200,
          last_message_role: 'user',
          last_message_content: 'Any update?',
          last_message_timestamp: '2025-01-02T00:00:00Z',
          similarity: null,
        },
      ]);

      const tools = await extractTools();
      const result = (await tools.query_issues.execute({
        type: 'feature',
      } as never)) as {
        count: number;
        issues: Array<{
          thread: { message_count: number; total_chars: number };
          last_message: {
            role: string;
            content: string;
            timestamp: string;
          } | null;
        }>;
      };

      expect(result.issues[0].thread).toEqual({
        message_count: 5,
        total_chars: 1200,
      });
      expect(result.issues[0].last_message).toEqual({
        role: 'user',
        content: 'Any update?',
        timestamp: '2025-01-02T00:00:00Z',
      });
    });
  });
});
