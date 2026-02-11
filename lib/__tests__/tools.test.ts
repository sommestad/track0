import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  ensureSchema: vi.fn(),
  getIssue: vi.fn(),
  getThreadMessages: vi.fn(),
}));

vi.mock('../format', () => ({
  formatIssueDetail: vi.fn(),
}));

vi.mock('../tell-agent', () => ({
  runTellAgent: vi.fn(),
}));

vi.mock('../ask-agent', () => ({
  runAskAgent: vi.fn(),
}));

import { ensureSchema, getIssue, getThreadMessages } from '../db';
import { formatIssueDetail } from '../format';
import { runTellAgent } from '../tell-agent';
import { runAskAgent } from '../ask-agent';
import { handleTell, handleAsk, handleGet } from '../tools';
import { createBaseIssue } from '../test-util';

const mockEnsureSchema = vi.mocked(ensureSchema);
const mockGetIssue = vi.mocked(getIssue);
const mockGetThreadMessages = vi.mocked(getThreadMessages);
const mockFormatIssueDetail = vi.mocked(formatIssueDetail);
const mockRunTellAgent = vi.mocked(runTellAgent);
const mockRunAskAgent = vi.mocked(runAskAgent);

const sampleIssue = createBaseIssue();

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsureSchema.mockResolvedValue(undefined);
});

describe('handleTell', () => {
  it('should delegate to runTellAgent', async () => {
    mockRunTellAgent.mockResolvedValue('Created wi_new123');

    const result = await handleTell('Add rate limiting');

    expect(mockRunTellAgent).toHaveBeenCalledWith(
      'Add rate limiting',
      undefined,
    );
    expect(result).toBe('Created wi_new123');
  });

  it('should pass issue_id to runTellAgent', async () => {
    mockRunTellAgent.mockResolvedValue('Updated wi_exist1');

    const result = await handleTell('Update this', 'wi_exist1');

    expect(mockRunTellAgent).toHaveBeenCalledWith('Update this', 'wi_exist1');
    expect(result).toBe('Updated wi_exist1');
  });

  it('should return error string on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRunTellAgent.mockRejectedValue(new Error('DB down'));

    const result = await handleTell('test message');

    expect(result).toContain('Error processing message');
    expect(result).toContain('DB down');
    consoleSpy.mockRestore();
  });
});

describe('handleAsk', () => {
  it('should delegate to runAskAgent', async () => {
    mockRunAskAgent.mockResolvedValue('There are 2 open bugs.');

    const result = await handleAsk('What bugs are open?');

    expect(mockRunAskAgent).toHaveBeenCalledWith('What bugs are open?');
    expect(result).toBe('There are 2 open bugs.');
  });

  it('should return error string on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRunAskAgent.mockRejectedValue(new Error('connection refused'));

    const result = await handleAsk('test');

    expect(result).toContain('Error answering question');
    expect(result).toContain('connection refused');
    consoleSpy.mockRestore();
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
