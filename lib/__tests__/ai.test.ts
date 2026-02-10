import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoObjectGeneratedError } from 'ai';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
    embed: vi.fn(),
    Output: actual.Output,
    NoObjectGeneratedError: actual.NoObjectGeneratedError,
  };
});

vi.mock('@ai-sdk/gateway', () => ({
  gateway: Object.assign(
    vi.fn(() => 'mock-model'),
    {
      textEmbeddingModel: vi.fn(() => 'mock-embedding-model'),
    },
  ),
}));

import { generateText, embed } from 'ai';
import { extractFields, generateEmbedding, answerQuestion } from '../ai';
import { ThreadMessage } from '../types';

const mockGenerateText = vi.mocked(generateText);
const mockEmbed = vi.mocked(embed);

const sampleMessages: ThreadMessage[] = [
  {
    id: 1,
    issue_id: 'wi_test1234',
    timestamp: '2025-01-01T10:00:00Z',
    role: 'assistant',
    content: 'Need to add rate limiting to the API.',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractFields', () => {
  it('should return parsed output on success', async () => {
    const expectedFields = {
      title: 'Add rate limiting',
      type: 'feature' as const,
      status: 'open' as const,
      priority: 2,
      labels: ['api'],
      summary: 'Rate limiting needed.',
    };

    mockGenerateText.mockResolvedValue({
      output: expectedFields,
    } as never);

    const result = await extractFields(sampleMessages);

    expect(result).toEqual(expectedFields);
    expect(mockGenerateText).toHaveBeenCalledOnce();
  });

  it('should return null on NoObjectGeneratedError', async () => {
    mockGenerateText.mockRejectedValue(
      new NoObjectGeneratedError({
        message: 'could not generate object',
        text: '',
        response: { id: '', modelId: '', timestamp: new Date() },
        usage: { promptTokens: 0, completionTokens: 0 },
      }),
    );

    const result = await extractFields(sampleMessages);

    expect(result).toBeNull();
  });

  it('should return null and log on other errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGenerateText.mockRejectedValue(new Error('API timeout'));

    const result = await extractFields(sampleMessages);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'extractFields failed:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});

describe('generateEmbedding', () => {
  it('should return embedding on success', async () => {
    const embedding = [0.1, 0.2, 0.3];
    mockEmbed.mockResolvedValue({ embedding } as never);

    const result = await generateEmbedding('test text');

    expect(result).toEqual(embedding);
    expect(mockEmbed).toHaveBeenCalledOnce();
  });

  it('should return null and log on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockEmbed.mockRejectedValue(new Error('embedding failed'));

    const result = await generateEmbedding('test text');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'generateEmbedding failed:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});

describe('answerQuestion', () => {
  it('should return text on success', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'The top priority is wi_abc.',
    } as never);

    const result = await answerQuestion('What is top priority?', []);

    expect(result).toBe('The top priority is wi_abc.');
  });

  it('should return friendly error string on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGenerateText.mockRejectedValue(new Error('API down'));

    const result = await answerQuestion('What is top priority?', []);

    expect(result).toBe('Failed to generate answer. Please try again.');
    consoleSpy.mockRestore();
  });
});
