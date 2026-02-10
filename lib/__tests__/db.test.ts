import { describe, it, expect } from 'vitest';
import { generateIssueId } from '../db';

describe('generateIssueId', () => {
  it('should produce an id with "wi_" prefix', () => {
    const id = generateIssueId();

    expect(id).toMatch(/^wi_/);
  });

  it('should produce an id with 8 chars after prefix', () => {
    const id = generateIssueId();

    expect(id).toHaveLength(11);
  });

  it('should only contain alphanumeric chars after prefix', () => {
    const id = generateIssueId();
    const suffix = id.slice(3);

    expect(suffix).toMatch(/^[a-zA-Z0-9]{8}$/);
  });

  it('should produce unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateIssueId()));

    expect(ids.size).toBe(50);
  });
});
