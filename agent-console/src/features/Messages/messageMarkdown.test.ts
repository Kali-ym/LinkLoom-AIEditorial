import { describe, expect, it } from 'vitest';

import {
  editorDataNeedsRichTextRenderer,
  ensureMarkdownLinks,
  extractPlainTextFromEditorData,
  sanitizeMermaidFences,
} from './messageMarkdown';

describe('sanitizeMermaidFences', () => {
  it('strips HTML line breaks inside mermaid blocks', () => {
    const input = [
      'intro',
      '',
      '```mermaid',
      'flowchart LR',
      '    S3[3. AI 摘要映射<br/>（无 LLM）]',
      '```',
      '',
      'tail',
    ].join('\n');

    const output = sanitizeMermaidFences(input);

    expect(output).toContain('S3[3. AI 摘要映射 （无 LLM）]');
    expect(output).not.toContain('<br');
    expect(output).toContain('intro');
    expect(output).toContain('tail');
  });
});

describe('ensureMarkdownLinks', () => {
  it('wraps bare URLs', () => {
    expect(ensureMarkdownLinks('https://cursor.com/')).toBe(
      '[https://cursor.com/](https://cursor.com/)',
    );
  });

  it('unwraps GFM angle autolinks before wrapping', () => {
    expect(ensureMarkdownLinks('<https://cursor.com>')).toBe(
      '[https://cursor.com](https://cursor.com)',
    );
    expect(ensureMarkdownLinks('<https://cursor.com>')).not.toContain('<');
  });
});

describe('editorDataNeedsRichTextRenderer', () => {
  const plainUrlEditorData = {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'https://cursor.com', version: 1 }],
        },
      ],
    },
  };

  const agentMentionEditorData = {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'mention', label: 'Copilot', metadata: { id: 'topic_copilot', type: 'agent' } },
            { type: 'text', text: ' https://cursor.com', version: 1 },
          ],
        },
      ],
    },
  };

  const inlineImageEditorData = {
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'image', version: 1 }] }],
    },
  };

  it('returns false for plain URL paragraphs', () => {
    expect(editorDataNeedsRichTextRenderer(plainUrlEditorData)).toBe(false);
  });

  it('returns false for @agent plus URL', () => {
    expect(editorDataNeedsRichTextRenderer(agentMentionEditorData)).toBe(false);
  });

  it('returns true for inline uploads', () => {
    expect(editorDataNeedsRichTextRenderer(inlineImageEditorData)).toBe(true);
  });

  it('extracts plain text from lexical json', () => {
    expect(extractPlainTextFromEditorData(plainUrlEditorData)).toBe('https://cursor.com');
  });
});
