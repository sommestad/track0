import { generateText, embed, Output, NoObjectGeneratedError } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import {
  IssueFieldsSchema,
  IssueFields,
  ThreadMessage,
  Issue,
  ThreadStats,
} from './types';
import { formatCharCount } from './format';

const EXTRACTION_PROMPT = `<role>
You are a structured data extractor for an issue tracker.
</role>

<task>
Read the conversation thread and extract the current state of the issue into structured fields. Always reflect the latest state of the conversation, not earlier messages that were superseded. If a current_summary is provided, treat it as prior state to be updated — the thread always takes precedence.
</task>

<field_rules>
<field name="title">
Imperative form, under 120 characters. Focus on the action or outcome.
Good: "Add rate limiting to memory API"
Bad: "Investigating rate limiting options"
</field>

<field name="type">
- "bug" = something broken, error, or not working as expected
- "feature" = new capability or enhancement
- "task" = everything else (refactors, investigations, documentation)
</field>

<field name="status">
- "open" = not started, just discussed
- "active" = work mentioned, in progress, or partially complete
- "done" = explicitly completed, closed, merged, or marked as resolved
</field>

<field name="priority">
Choose exactly one:
- 1 = critical/urgent (blocking, security, production issue)
- 2 = high (important, time-sensitive)
- 3 = normal (default when no urgency indicated and the change has functional impact)
- 4 = backlog (nice-to-have, future consideration)
- 5 = negligible impact (typo fix, formatting, import reorder, whitespace — purely mechanical with no behavioral change)
</field>

<field name="labels">
3-8 relevant tags. Use lowercase, single-word or hyphenated terms. Examples: "backend", "auth", "rate-limiting", "api", "frontend".
</field>

<field name="summary">
2-3 sentences covering: (1) what this issue is about, (2) current status and decisions made, (3) concrete next steps if any were discussed. Do not speculate about next steps that were not mentioned.
</field>
</field_rules>`;

const QA_PROMPT = `<role>
You are an issue tracker assistant.
</role>

<task>
Answer the user's question using only the issue data provided below. Be direct and specific. Avoid preambles — just answer.
</task>

<guidelines>
- Reference issues by ID in parentheses, e.g. "The auth refactor (wi_a3Kx) is in progress"
- Give complete but focused answers — include relevant context without unnecessary detail
- When asked about priority or "what's next", recommend priority 1-2 issues first, then "open" over "active"
- If multiple issues match, list up to 3 most relevant
- If no issues match, say so clearly and suggest related issues if any exist
- Only reference issues listed below. Never infer issues not present in the data.
</guidelines>`;

function formatThreadForExtraction(messages: ThreadMessage[]): string {
  return messages
    .map(
      (m) =>
        `[${new Date(m.timestamp).toISOString().slice(0, 16).replace('T', ' ')} ${m.role}] ${m.content}`,
    )
    .join('\n\n');
}

function formatIssuesForQA(
  issues: Issue[],
  stats_map: Map<string, ThreadStats>,
): string {
  return issues
    .map((i) => {
      const updated = new Date(i.updated_at).toISOString().slice(0, 10);
      const stats = stats_map.get(i.id);
      const thread_info = stats
        ? ` | ${stats.message_count} msgs ${formatCharCount(stats.total_chars)}`
        : '';
      return `${i.id} | P${i.priority} ${i.type} | ${i.status} | ${i.title} | updated ${updated}${thread_info}\n  ${i.summary}`;
    })
    .join('\n\n');
}

export async function extractFields(
  messages: ThreadMessage[],
  currentSummary?: string,
): Promise<IssueFields | null> {
  const threadContext = formatThreadForExtraction(messages);
  try {
    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4.5'),
      prompt: `${EXTRACTION_PROMPT}
${currentSummary ? `\n<current_summary>\n${currentSummary}\n</current_summary>` : ''}
<thread>
${threadContext}
</thread>`,
      output: Output.object({ schema: IssueFieldsSchema }),
    });
    return result.output;
  } catch (error) {
    if (error instanceof NoObjectGeneratedError) {
      return null;
    }
    console.error('extractFields failed:', error);
    return null;
  }
}

export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  try {
    const result = await embed({
      model: gateway.textEmbeddingModel('openai/text-embedding-3-small'),
      value: text,
    });
    return result.embedding;
  } catch (error) {
    console.error('generateEmbedding failed:', error);
    return null;
  }
}

export async function answerQuestion(
  question: string,
  issues: Issue[],
  stats_map: Map<string, ThreadStats>,
): Promise<string> {
  const issueContext = formatIssuesForQA(issues, stats_map);

  try {
    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4.5'),
      prompt: `${QA_PROMPT}\n\n<issues>\n${issueContext}\n</issues>\n\n<question>\n${question}\n</question>`,
    });
    return result.text;
  } catch (error) {
    console.error('answerQuestion failed:', error);
    return 'Failed to generate answer. Please try again.';
  }
}
