import { describe, expect, it, vi, beforeEach } from 'vitest';

const invoke = vi.fn().mockResolvedValue({ content: 'ok' });
const bindTools = vi.fn().mockReturnValue({ invoke });

vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: class MockChatGoogleGenerativeAI {
    bindTools = bindTools;
  },
}));

describe('GeminiProvider builtinSearch', () => {
  beforeEach(() => { bindTools.mockClear(); });

  it('binds google_search only when builtinSearch is full', async () => {
    const { createAIProvider } = await import('../src/services/AIProvider.js');
    const off = createAIProvider({ type: 'GEMINI', apiUrl: 'http://x', apiKey: 'k', model: 'gemini-2.0-flash', builtinSearch: 'off' });
    await off!.generateContent('hi', [], 'sys');
    const offArgs = bindTools.mock.calls.at(-1)?.[0] as unknown[];
    expect(offArgs.some((t) => JSON.stringify(t).includes('google_search'))).toBe(false);

    bindTools.mockClear();
    const full = createAIProvider({ type: 'GEMINI', apiUrl: 'http://x', apiKey: 'k', model: 'gemini-2.0-flash', builtinSearch: 'full' });
    await full!.generateContent('hi', [], 'sys');
    const fullArgs = bindTools.mock.calls.at(-1)?.[0] as unknown[];
    expect(fullArgs.some((t) => JSON.stringify(t).includes('google_search'))).toBe(true);
  });
});
