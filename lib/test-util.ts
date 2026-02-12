import { Issue, IssueFields } from './types';

export function createBaseIssue(overrides?: Partial<Issue>): Issue {
  return {
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
    last_message_by: null,
    ...overrides,
  };
}

export function createBaseIssueFields(
  overrides?: Partial<IssueFields>,
): IssueFields {
  return {
    title: 'Test issue',
    type: 'task',
    status: 'open',
    priority: 3,
    labels: [],
    summary: 'A test issue summary.',
    ...overrides,
  };
}
