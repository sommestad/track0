import { describe, it, expect } from 'vitest';
import {
  formatIssueConfirmation,
  formatIssueDetail,
  formatIssueList,
  formatLowPriorityRejection,
  computeThreadStats,
  formatThreadStats,
  formatCharCount,
} from '../format';
import { ThreadMessage, ThreadStats } from '../types';
import { createBaseIssue, createBaseIssueFields } from '../test-util';

const baseIssue = createBaseIssue({
  id: 'wi_abc12345',
  title: 'Add rate limiting',
  type: 'feature',
  priority: 2,
  labels: ['backend', 'api'],
  summary: 'Need rate limiting on the memory API.',
  updated_at: '2025-01-15T00:00:00Z',
});

describe('formatCharCount', () => {
  it('should show raw number for < 1000 chars', () => {
    expect(formatCharCount(800)).toBe('~800 chars');
  });

  it('should show one decimal for 1000-9999 chars', () => {
    expect(formatCharCount(1200)).toBe('~1.2k chars');
  });

  it('should show rounded k for >= 10000 chars', () => {
    expect(formatCharCount(12345)).toBe('~12k chars');
  });

  it('should handle zero', () => {
    expect(formatCharCount(0)).toBe('~0 chars');
  });
});

describe('computeThreadStats', () => {
  it('should compute stats from messages', () => {
    const messages: ThreadMessage[] = [
      {
        id: 1,
        issue_id: 'wi_abc12345',
        timestamp: '2025-01-01T10:00:00Z',
        role: 'assistant',
        content: 'Hello',
      },
      {
        id: 2,
        issue_id: 'wi_abc12345',
        timestamp: '2025-01-01T11:00:00Z',
        role: 'user',
        content: 'World!',
      },
    ];

    const stats = computeThreadStats(messages);

    expect(stats.message_count).toBe(2);
    expect(stats.total_chars).toBe(11);
  });

  it('should return zeros for empty messages', () => {
    const stats = computeThreadStats([]);

    expect(stats.message_count).toBe(0);
    expect(stats.total_chars).toBe(0);
  });
});

describe('formatThreadStats', () => {
  it('should format plural messages', () => {
    const stats: ThreadStats = { message_count: 3, total_chars: 1200 };

    expect(formatThreadStats(stats)).toBe('[thread: 3 msgs, ~1.2k chars]');
  });

  it('should format singular message', () => {
    const stats: ThreadStats = { message_count: 1, total_chars: 500 };

    expect(formatThreadStats(stats)).toBe('[thread: 1 msg, ~500 chars]');
  });

  it('should add thin context hint when message_count < 2 and total_chars < 200', () => {
    const stats: ThreadStats = { message_count: 1, total_chars: 80 };

    const result = formatThreadStats(stats);

    expect(result).toContain('context is thin');
    expect(result).toContain('consider providing more detail');
  });

  it('should not add thin context hint when message_count >= 2', () => {
    const stats: ThreadStats = { message_count: 2, total_chars: 100 };

    expect(formatThreadStats(stats)).not.toContain('context is thin');
  });

  it('should not add thin context hint when total_chars >= 200', () => {
    const stats: ThreadStats = { message_count: 1, total_chars: 250 };

    expect(formatThreadStats(stats)).not.toContain('context is thin');
  });
});

describe('formatIssueConfirmation', () => {
  const defaultStats: ThreadStats = { message_count: 3, total_chars: 1200 };

  it('should format a created issue compactly', () => {
    const result = formatIssueConfirmation(baseIssue, 'Created', defaultStats);

    expect(result).toContain('Created wi_abc12345: "Add rate limiting"');
    expect(result).toContain('P2 feature | open | backend, api');
    expect(result).toContain('Need rate limiting on the memory API.');
    expect(result).toContain('[thread: 3 msgs, ~1.2k chars]');
  });

  it('should format an updated issue', () => {
    const result = formatIssueConfirmation(baseIssue, 'Updated', defaultStats);

    expect(result).toContain('Updated wi_abc12345');
  });

  it('should show "none" when labels are empty', () => {
    const issue = createBaseIssue({ labels: [] });
    const result = formatIssueConfirmation(issue, 'Created', defaultStats);

    expect(result).toContain('| none');
  });

  it('should show "No summary yet." when summary is empty', () => {
    const issue = createBaseIssue({ summary: '' });
    const result = formatIssueConfirmation(issue, 'Created', defaultStats);

    expect(result).toContain('No summary yet.');
  });

  it('should not contain redundant labels like TYPE: or STATUS:', () => {
    const result = formatIssueConfirmation(baseIssue, 'Created', defaultStats);

    expect(result).not.toContain('TYPE:');
    expect(result).not.toContain('STATUS:');
    expect(result).not.toContain('PRIORITY:');
    expect(result).not.toContain('LABELS:');
    expect(result).not.toContain('SUMMARY:');
  });
});

describe('formatIssueDetail', () => {
  it('should format issue header with dates and compact fields', () => {
    const result = formatIssueDetail(baseIssue, []);

    expect(result).toContain('wi_abc12345: "Add rate limiting"');
    expect(result).toContain('P2 feature | open | backend, api');
    expect(result).toContain('Created 2025-01-01 | Updated 2025-01-15');
    expect(result).toContain('Need rate limiting on the memory API.');
  });

  it('should not contain redundant labels', () => {
    const result = formatIssueDetail(baseIssue, []);

    expect(result).not.toContain('STATUS:');
    expect(result).not.toContain('TYPE:');
    expect(result).not.toContain('PRIORITY:');
    expect(result).not.toContain('LABELS:');
    expect(result).not.toContain('SUMMARY:');
  });

  it('should omit thread section when messages are empty', () => {
    const result = formatIssueDetail(baseIssue, []);

    expect(result).not.toContain('THREAD');
  });

  it('should include thread with stats when messages are present', () => {
    const messages: ThreadMessage[] = [
      {
        id: 1,
        issue_id: 'wi_abc12345',
        timestamp: '2025-01-01T10:30:00Z',
        role: 'assistant',
        content: 'Working on rate limiting now.',
      },
      {
        id: 2,
        issue_id: 'wi_abc12345',
        timestamp: '2025-01-15T09:00:00Z',
        role: 'user',
        content: 'Proceed with implementation.',
      },
    ];

    const result = formatIssueDetail(baseIssue, messages);

    expect(result).toContain('THREAD (2 msgs,');
    expect(result).toContain('2025-01-01 10:30');
    expect(result).toContain('assistant');
    expect(result).toContain('Working on rate limiting now.');
    expect(result).toContain('2025-01-15 09:00');
    expect(result).toContain('Proceed with implementation.');
  });
});

describe('formatIssueList', () => {
  it('should return "No issues found." for empty list', () => {
    const result = formatIssueList([]);

    expect(result).toBe('No issues found.');
  });

  it('should format multiple issues', () => {
    const issues = [
      baseIssue,
      createBaseIssue({
        id: 'wi_def67890',
        title: 'Fix login bug',
        type: 'bug',
        status: 'active',
        priority: 1,
      }),
    ];

    const result = formatIssueList(issues);

    expect(result).toContain(
      'wi_abc12345 | P2 feature | open | Add rate limiting',
    );
    expect(result).toContain('wi_def67890 | P1 bug | active | Fix login bug');
  });
});

describe('formatLowPriorityRejection', () => {
  it('should format rejection with priority, title, type, and summary', () => {
    const fields = createBaseIssueFields({
      title: 'Fix typo in readme',
      status: 'done',
      priority: 5,
      labels: ['docs'],
      summary: 'Fixed a typo in the README file.',
    });

    const result = formatLowPriorityRejection(fields);

    expect(result).toContain('Not tracked (P5');
    expect(result).toContain('below threshold');
    expect(result).toContain('"Fix typo in readme"');
    expect(result).toContain('task');
    expect(result).toContain('Fixed a typo in the README file.');
    expect(result).toContain('provide more context');
  });
});
