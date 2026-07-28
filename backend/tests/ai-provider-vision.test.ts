import { describe, expect, it } from 'vitest';

import {
  normalizeApiMessageContent,
  toResponsesApiMessageContent,
} from '../src/services/AIProvider.js';

describe('normalizeApiMessageContent vision parts', () => {
  it('preserves image_url parts for user multimodal content', () => {
    expect(
      normalizeApiMessageContent(
        [
          { type: 'text', text: 'describe this' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,abc' },
          },
        ],
        'user',
      ),
    ).toEqual([
      { type: 'text', text: 'describe this' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
    ]);
  });

  it('keeps text-only flattening for arrays without images', () => {
    expect(
      normalizeApiMessageContent(
        [{ type: 'text', text: 'hello' }, { type: 'text', text: 'world' }],
        'user',
      ),
    ).toBe('hello\n\nworld');
  });

  it('maps chat-completions vision parts to Responses API input_image', () => {
    const chatContent = normalizeApiMessageContent(
      [
        { type: 'text', text: 'describe this' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,abc' },
        },
      ],
      'user',
    );

    expect(toResponsesApiMessageContent(chatContent)).toEqual([
      { type: 'input_text', text: 'describe this' },
      { type: 'input_image', image_url: 'data:image/png;base64,abc', detail: 'auto' },
    ]);
  });
});
