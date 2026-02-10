import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  ensureSchema: vi.fn(),
  generateIssueId: vi.fn(),
  createIssue: vi.fn(),
  getIssue: vi.fn(),
  updateIssueFields: vi.fn(),
  updateIssueEmbedding: vi.fn(),
  addThreadMessage: vi.fn(),
  getThreadMessages: vi.fn(),
  getNonDoneIssues: vi.fn(),
  vectorSearch: vi.fn(),
  getThreadStats: vi.fn(),
  getThreadStatsBatch: vi.fn(),
}));

vi.mock('../ai', () => ({
  extractFields: vi.fn(),
  generateEmbedding: vi.fn(),
  answerQuestion: vi.fn(),
}));

vi.mock('../format', () => ({
  formatIssueConfirmation: vi.fn(),
  formatIssueDetail: vi.fn(),
  computeThreadStats: vi.fn(),
}));

import {
  ensureSchema,
  generateIssueId,
  createIssue,
  getIssue,
  updateIssueFields,
  updateIssueEmbedding,
  addThreadMessage,
  getThreadMessages,
  getNonDoneIssues,
  vectorSearch,
  getThreadStats,
  getThreadStatsBatch,
} from '../db';
import { extractFields, generateEmbedding, answerQuestion } from '../ai';
import {
  formatIssueConfirmation,
  formatIssueDetail,
  computeThreadStats,
} from '../format';
import { handleTell, handleAsk, handleGet } from '../tools';
import { Issue } from '../types';

const mockEnsureSchema = vi.mocked(ensureSchema);
const mockGenerateIssueId = vi.mocked(generateIssueId);
const mockCreateIssue = vi.mocked(createIssue);
const mockGetIssue = vi.mocked(getIssue);
const mockUpdateIssueFields = vi.mocked(updateIssueFields);
const mockUpdateIssueEmbedding = vi.mocked(updateIssueEmbedding);
const mockAddThreadMessage = vi.mocked(addThreadMessage);
const mockGetThreadMessages = vi.mocked(getThreadMessages);
const mockGetNonDoneIssues = vi.mocked(getNonDoneIssues);
const mockVectorSearch = vi.mocked(vectorSearch);
const mockGetThreadStats = vi.mocked(getThreadStats);
const mockGetThreadStatsBatch = vi.mocked(getThreadStatsBatch);
const mockExtractFields = vi.mocked(extractFields);
const mockGenerateEmbedding = vi.mocked(generateEmbedding);
const mockAnswerQuestion = vi.mocked(answerQuestion);
const mockFormatIssueConfirmation = vi.mocked(formatIssueConfirmation);
const mockFormatIssueDetail = vi.mocked(formatIssueDetail);

const sampleIssue: Issue = {
  id: 'wi_test1234',
  title: 'Test issue',
  type: 'task',
  status: 'open',
  priority: 3,
  labels: [],
  summary: 'A test issue.',
  embedding: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsureSchema.mockResolvedValue(undefined);
});

describe('handleTell', () => {
  describe('with new issue (no id given)', () => {
    beforeEach(() => {
      mockGenerateIssueId.mockReturnValue('wi_new12345');
      mockCreateIssue.mockResolvedValue(undefined);
      mockGetIssue.mockResolvedValue({ ...sampleIssue, id: 'wi_new12345' });
      mockAddThreadMessage.mockResolvedValue(undefined);
      mockGetThreadMessages.mockResolvedValue([]);
      mockExtractFields.mockResolvedValue({
        title: 'New issue',
        type: 'task',
        status: 'open',
        priority: 3,
        labels: [],
        summary: 'New issue summary.',
      });
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockUpdateIssueFields.mockResolvedValue(undefined);
      mockUpdateIssueEmbedding.mockResolvedValue(undefined);
      mockGetThreadStats.mockResolvedValue({
        message_count: 1,
        total_chars: 80,
      });
      mockFormatIssueConfirmation.mockReturnValue('Created wi_new12345');
    });

    it('should create a new issue and return confirmation', async () => {
      const result = await handleTell('Create a new task');

      expect(mockGenerateIssueId).toHaveBeenCalledOnce();
      expect(mockCreateIssue).toHaveBeenCalledWith('wi_new12345');
      expect(mockGetThreadStats).toHaveBeenCalledWith('wi_new12345');
      expect(mockFormatIssueConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wi_new12345' }),
        'Created',
        { message_count: 1, total_chars: 80 },
      );
      expect(result).toBe('Created wi_new12345');
    });
  });

  describe('with existing issue (id given)', () => {
    beforeEach(() => {
      mockGetIssue.mockResolvedValue(sampleIssue);
      mockAddThreadMessage.mockResolvedValue(undefined);
      mockGetThreadMessages.mockResolvedValue([]);
      mockExtractFields.mockResolvedValue(null);
      mockGetThreadStats.mockResolvedValue({
        message_count: 3,
        total_chars: 500,
      });
      mockFormatIssueConfirmation.mockReturnValue('Updated wi_test1234');
    });

    it('should update the existing issue', async () => {
      const result = await handleTell('Update this', 'wi_test1234');

      expect(mockGenerateIssueId).not.toHaveBeenCalled();
      expect(mockCreateIssue).not.toHaveBeenCalled();
      expect(mockGetThreadStats).toHaveBeenCalledWith('wi_test1234');
      expect(mockFormatIssueConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wi_test1234' }),
        'Updated',
        { message_count: 3, total_chars: 500 },
      );
      expect(result).toBe('Updated wi_test1234');
    });
  });

  describe('with missing issue', () => {
    it('should return "not found" for a missing issue', async () => {
      mockGetIssue.mockResolvedValue(null);

      const result = await handleTell('Update this', 'wi_gone0000');

      expect(result).toBe('Issue not found: wi_gone0000');
    });
  });

  describe('on db failure', () => {
    it('should return error string', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockEnsureSchema.mockRejectedValue(new Error('DB down'));

      const result = await handleTell('test message');

      expect(result).toContain('Error processing message');
      expect(result).toContain('DB down');
      consoleSpy.mockRestore();
    });
  });
});

describe('handleAsk', () => {
  describe('with results', () => {
    it('should combine non-done and vector results and prefix with scope', async () => {
      const issueA = { ...sampleIssue, id: 'wi_aaaa' };
      const issueB = { ...sampleIssue, id: 'wi_bbbb' };
      const issueC = {
        ...sampleIssue,
        id: 'wi_aaaa',
        similarity: 0.9,
      };

      mockGetNonDoneIssues.mockResolvedValue([issueA]);
      mockGenerateEmbedding.mockResolvedValue([0.1]);
      mockVectorSearch.mockResolvedValue([
        issueC as Issue & { similarity: number },
        { ...issueB, similarity: 0.8 } as Issue & { similarity: number },
      ]);
      mockGetThreadStatsBatch.mockResolvedValue(new Map());
      mockAnswerQuestion.mockResolvedValue('Answer here.');

      const result = await handleAsk('What is next?');

      expect(mockGetThreadStatsBatch).toHaveBeenCalledWith(
        expect.arrayContaining(['wi_aaaa', 'wi_bbbb']),
      );
      expect(mockAnswerQuestion).toHaveBeenCalledWith(
        'What is next?',
        expect.arrayContaining([
          expect.objectContaining({ id: 'wi_aaaa' }),
          expect.objectContaining({ id: 'wi_bbbb' }),
        ]),
        expect.any(Map),
      );
      expect(result).toContain('[2 issues matched, 1 total active]');
      expect(result).toContain('Answer here.');
    });
  });

  describe('with no issues', () => {
    it('should return "No issues found." when empty', async () => {
      mockGetNonDoneIssues.mockResolvedValue([]);
      mockGenerateEmbedding.mockResolvedValue([0.1]);
      mockVectorSearch.mockResolvedValue([]);

      const result = await handleAsk('Any tasks?');

      expect(result).toBe('No issues found.');
    });
  });

  describe('on failure', () => {
    it('should return error string', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockEnsureSchema.mockRejectedValue(new Error('connection refused'));

      const result = await handleAsk('test');

      expect(result).toContain('Error answering question');
      expect(result).toContain('connection refused');
      consoleSpy.mockRestore();
    });
  });
});

describe('handleGet', () => {
  describe('with existing issue', () => {
    it('should return formatted detail', async () => {
      mockGetIssue.mockResolvedValue(sampleIssue);
      mockGetThreadMessages.mockResolvedValue([]);
      mockFormatIssueDetail.mockReturnValue('Formatted detail');

      const result = await handleGet('wi_test1234');

      expect(mockFormatIssueDetail).toHaveBeenCalledWith(sampleIssue, []);
      expect(result).toBe('Formatted detail');
    });
  });

  describe('with missing issue', () => {
    it('should return "not found"', async () => {
      mockGetIssue.mockResolvedValue(null);

      const result = await handleGet('wi_gone0000');

      expect(result).toBe('Issue not found: wi_gone0000');
    });
  });

  describe('on failure', () => {
    it('should return error string', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockEnsureSchema.mockRejectedValue(new Error('timeout'));

      const result = await handleGet('wi_test1234');

      expect(result).toContain('Error retrieving issue');
      expect(result).toContain('timeout');
      consoleSpy.mockRestore();
    });
  });
});
