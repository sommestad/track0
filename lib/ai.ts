import { generateText, embed, Output, NoObjectGeneratedError } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { IssueFieldsSchema, IssueFields, ThreadMessage, Issue } from './types';

const EXTRACTION_PROMPT = `You are a structured data extractor for an issue tracker. Extract the current state from the conversation thread.

FIELD RULES:
- title: Imperative form, under 120 characters. Focus on the action/outcome (e.g. "Add rate limiting to memory API", not "Investigating rate limiting options").

- type:
  * "bug" = something broken, error, or not working as expected
  * "feature" = new capability or enhancement
  * "task" = everything else (refactors, investigations, documentation, etc.)

- status:
  * "open" = not started, just discussed
  * "active" = work mentioned, in progress, or partially complete
  * "done" = explicitly completed, closed, merged, or marked as resolved

- priority (choose exactly one):
  * 1 = critical/urgent (blocking, security, production issue)
  * 2 = high (important, time-sensitive)
  * 3 = normal (default when no urgency indicated)
  * 4 = backlog (nice-to-have, future consideration)

- labels: 3-8 relevant tags (tech stack, area, or theme). Examples: "backend", "auth", "performance", "api", "frontend".

- summary: 2-3 sentences answering: What is this issue about? What's the current situation? What happens next? Focus on decisions made and actionable next steps.`;

const QA_PROMPT = `You are an issue tracker assistant. Answer questions using only the issue data below.

GUIDELINES:
- Reference issues by ID in parentheses, e.g. "The auth refactor (wi_a3Kx) is in progress"
- Give complete but focused answers — include relevant context without unnecessary detail
- When asked about priority or "what's next", recommend priority 1-2 issues first, then "open" over "active"
- If multiple issues match, list up to 3 most relevant
- If no issues match, say so clearly and suggest related issues if any exist
- Only reference issues listed in the ISSUES section. Never infer issues not present in the data.`;

function formatThreadForExtraction(messages: ThreadMessage[]): string {
  return messages
    .map(
      (m) =>
        `[${new Date(m.timestamp).toISOString().slice(0, 16).replace('T', ' ')} ${m.role}] ${m.content}`,
    )
    .join('\n\n');
}

function formatIssuesForQA(issues: Issue[]): string {
  return issues
    .map(
      (i) =>
        `${i.id} | P${i.priority} ${i.type} | ${i.status} | ${i.title}\n  ${i.summary}`,
    )
    .join('\n\n');
}

export async function extractFields(
  messages: ThreadMessage[],
  currentSummary?: string,
): Promise<IssueFields | null> {
  const threadContext = formatThreadForExtraction(messages);
  const summaryContext = currentSummary
    ? `\nCURRENT SUMMARY: ${currentSummary}\n`
    : '';

  try {
    const result = await generateText({
      model: gateway('openai/gpt-5-2'),
      providerOptions: { openai: { reasoningEffort: 'none' } },
      prompt: `${EXTRACTION_PROMPT}\n${summaryContext}\nTHREAD:\n${threadContext}`,
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
): Promise<string> {
  const issueContext = formatIssuesForQA(issues);

  try {
    const result = await generateText({
      model: gateway('openai/gpt-5-2'),
      providerOptions: { openai: { reasoningEffort: 'none' } },
      prompt: `${QA_PROMPT}\n\nISSUES:\n${issueContext}\n\nQUESTION: ${question}`,
    });
    return result.text;
  } catch (error) {
    console.error('answerQuestion failed:', error);
    return 'Failed to generate answer. Please try again.';
  }
}
