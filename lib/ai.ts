import { generateText, embed, Output, NoObjectGeneratedError } from 'ai';
import { openai } from '@ai-sdk/openai';
import { IssueFieldsSchema, IssueFields, ThreadMessage, Issue } from './types';

const EXTRACTION_PROMPT = `You are a structured data extractor for an issue tracker. Given the conversation thread below, extract the current state of this issue.

RULES:
- title: short imperative form, <60 chars (e.g. "Add rate limiting to memory API")
- type: "bug" if it describes a problem/error, "feature" if new functionality, "task" for everything else
- status: "open" if not started, "active" if work mentioned/in progress, "done" ONLY if explicitly completed/closed/merged
- priority: 1=critical, 2=high, 3=medium, 4=low, 5=someday. Infer from urgency words or explicit priority mentions. Default 3.
- labels: extract relevant topic tags (e.g. "backend", "auth", "performance"). Max 5.
- summary: 2-3 sentences describing the CURRENT state for a human reading a dashboard. Include key decisions and next steps.`;

const QA_PROMPT = `You are an issue tracker assistant. Answer the user's question based on the issue data below.

RULES:
- Reference issues by their ID (e.g. wi_a3Kx)
- Be concise and direct
- If asked "what's ready/next", recommend the highest-priority open item
- If no issues match the question, say so clearly
- Do not make up issues that don't exist in the data`;

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
      model: openai('gpt-4o-mini'),
      prompt: `${EXTRACTION_PROMPT}\n${summaryContext}\nTHREAD:\n${threadContext}`,
      output: Output.object({ schema: IssueFieldsSchema }),
    });
    return result.output;
  } catch (error) {
    if (error instanceof NoObjectGeneratedError) {
      return null;
    }
    throw error;
  }
}

export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  try {
    const result = await embed({
      model: openai.embeddingModel('text-embedding-3-small'),
      value: text,
    });
    return result.embedding;
  } catch {
    return null;
  }
}

export async function answerQuestion(
  question: string,
  issues: Issue[],
): Promise<string> {
  const issueContext = formatIssuesForQA(issues);

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `${QA_PROMPT}\n\nISSUES:\n${issueContext}\n\nQUESTION: ${question}`,
  });

  return result.text;
}
