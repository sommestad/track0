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
  last_message_by: 'user' | 'assistant' | 'system' | null;
}

export interface ThreadMessage {
  id: number;
  issue_id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ThreadStats {
  message_count: number;
  total_chars: number;
}

export const IssueFieldsSchema = z.object({
  title: z.string().describe('Short imperative title, under 120 chars'),
  type: z.enum(['bug', 'feature', 'task']),
  status: z.enum(['open', 'active', 'done']),
  priority: z.number().describe('1 (critical) to 5 (negligible)'),
  labels: z.array(z.string()).describe('3-8 relevant tags'),
  summary: z.string().describe('2-3 sentence summary of current state'),
});

export type IssueFields = z.infer<typeof IssueFieldsSchema>;
