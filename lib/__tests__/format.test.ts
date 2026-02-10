import { describe, it, expect } from 'vitest';
import {
  formatIssueConfirmation,
  formatIssueDetail,
  formatIssueList,
} from '../format';
import { Issue, ThreadMessage } from '../types';

const baseIssue: Issue = {
  id: 'wi_abc12345',
  title: 'Add rate limiting',
  type: 'feature',
  status: 'open',
  priority: 2,
  labels: ['backend', 'api'],
  summary: 'Need rate limiting on the memory API.',
  embedding: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('formatIssueConfirmation', () => {
  it('should format a created issue with labels', () => {
    const result = formatIssueConfirmation(baseIssue, 'Created');

    expect(result).toContain('Created wi_abc12345');
    expect(result).toContain('"Add rate limiting"');
    expect(result).toContain('TYPE: feature');
    expect(result).toContain('STATUS: open');
    expect(result).toContain('PRIORITY: 2');
    expect(result).toContain('LABELS: backend, api');
    expect(result).toContain('SUMMARY: Need rate limiting');
  });

  it('should format an updated issue', () => {
    const result = formatIssueConfirmation(baseIssue, 'Updated');

    expect(result).toContain('Updated wi_abc12345');
  });

  it('should show "none" when labels are empty', () => {
    const issue = { ...baseIssue, labels: [] };
    const result = formatIssueConfirmation(issue, 'Created');

    expect(result).toContain('LABELS: none');
  });

  it('should show "No summary yet." when summary is empty', () => {
    const issue = { ...baseIssue, summary: '' };
    const result = formatIssueConfirmation(issue, 'Created');

    expect(result).toContain('SUMMARY: No summary yet.');
  });
});

describe('formatIssueDetail', () => {
  it('should format issue header with labels', () => {
    const result = formatIssueDetail(baseIssue, []);

    expect(result).toContain('wi_abc12345 | Add rate limiting');
    expect(result).toContain('STATUS: open');
    expect(result).toContain('TYPE: feature');
    expect(result).toContain('PRIORITY: 2');
    expect(result).toContain('LABELS: backend, api');
  });

  it('should omit thread section when messages are empty', () => {
    const result = formatIssueDetail(baseIssue, []);

    expect(result).not.toContain('THREAD:');
  });

  it('should include thread when messages are present', () => {
    const messages: ThreadMessage[] = [
      {
        id: 1,
        issue_id: 'wi_abc12345',
        timestamp: '2025-01-01T10:30:00Z',
        role: 'claude',
        content: 'Working on rate limiting now.',
      },
    ];

    const result = formatIssueDetail(baseIssue, messages);

    expect(result).toContain('THREAD:');
    expect(result).toContain('2025-01-01 10:30');
    expect(result).toContain('claude');
    expect(result).toContain('Working on rate limiting now.');
  });
});

describe('formatIssueList', () => {
  it('should return "No issues found." for empty list', () => {
    const result = formatIssueList([]);

    expect(result).toBe('No issues found.');
  });

  it('should format multiple issues', () => {
    const issues: Issue[] = [
      baseIssue,
      {
        ...baseIssue,
        id: 'wi_def67890',
        title: 'Fix login bug',
        type: 'bug',
        status: 'active',
        priority: 1,
      },
    ];

    const result = formatIssueList(issues);

    expect(result).toContain(
      'wi_abc12345 | P2 feature | open | Add rate limiting',
    );
    expect(result).toContain('wi_def67890 | P1 bug | active | Fix login bug');
  });
});
