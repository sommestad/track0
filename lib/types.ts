import { z } from 'zod';

export interface Issue {
  id: string;
  title: string;
  type: 'bug' | 'feature' | 'task';
  status: 'open' | 'active' | 'done';
  priority: number;
  labels: string[];
  summary: string;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface ThreadMessage {
  id: number;
  issue_id: string;
  timestamp: string;
  role: 'human' | 'claude' | 'system';
  content: string;
}

export const IssueFieldsSchema = z.object({
  title: z
    .string()
    .max(120)
    .describe('Short imperative title, <60 chars'),
  type: z.enum(['bug', 'feature', 'task']),
  status: z.enum(['open', 'active', 'done']),
  priority: z.number().min(1).max(5),
  labels: z.array(z.string().max(50)).max(10),
  summary: z
    .string()
    .max(1000)
    .describe('2-3 sentence summary of CURRENT state for a human dashboard'),
});

export type IssueFields = z.infer<typeof IssueFieldsSchema>;
