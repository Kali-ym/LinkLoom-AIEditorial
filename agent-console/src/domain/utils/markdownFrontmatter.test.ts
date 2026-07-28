import { describe, expect, it } from 'vitest';

import {
  buildDocumentFrontmatterRows,
  documentFrontmatterForEdit,
  parseMarkdownFrontmatter,
  patchDocumentFrontmatter,
  serializeMarkdownFrontmatter,
} from './markdownFrontmatter';

describe('parseMarkdownFrontmatter', () => {
  it('splits yaml frontmatter from body', () => {
    const source = `---
title: LinkLoom 接入方案
status: draft
tags: agent, portal
---
# Heading

Body text
`;

    const { frontmatter, body } = parseMarkdownFrontmatter(source);
    expect(frontmatter.title).toBe('LinkLoom 接入方案');
    expect(frontmatter.status).toBe('draft');
    expect(frontmatter.tags).toBe('agent, portal');
    expect(body).toContain('# Heading');
    expect(body).toContain('Body text');
  });

  it('returns full markdown as body when no frontmatter', () => {
    const { frontmatter, body } = parseMarkdownFrontmatter('# Hello');
    expect(frontmatter.raw).toEqual({});
    expect(body).toBe('# Hello');
  });
});

describe('serializeMarkdownFrontmatter', () => {
  it('round-trips body with frontmatter block', () => {
    const parsed = parseMarkdownFrontmatter(`---
title: Demo
status: draft
---
# Title
`);
    const serialized = serializeMarkdownFrontmatter(parsed.frontmatter, parsed.body);
    const again = parseMarkdownFrontmatter(serialized);
    expect(again.frontmatter.title).toBe('Demo');
    expect(again.body.trim()).toBe('# Title');
  });
});

describe('buildDocumentFrontmatterRows', () => {
  it('uses fallback title when missing', () => {
    const rows = buildDocumentFrontmatterRows({ raw: {} }, 'notes.md');
    expect(rows[0]).toEqual({ key: 'title', value: 'notes.md' });
  });
});

describe('patchDocumentFrontmatter', () => {
  it('updates raw fields for serialization', () => {
    const next = patchDocumentFrontmatter({ raw: { title: 'A', status: 'draft' } }, {
      title: 'B',
      status: 'published',
      tags: 'x, y',
    });
    expect(next.raw).toEqual({ title: 'B', status: 'published', tags: 'x, y' });
  });

  it('removes empty tags from raw', () => {
    const next = patchDocumentFrontmatter(
      { raw: { title: 'A', tags: 'old' } },
      { tags: '  ' },
    );
    expect(next.raw.tags).toBeUndefined();
  });
});

describe('documentFrontmatterForEdit', () => {
  it('fills defaults for empty frontmatter', () => {
    const fm = documentFrontmatterForEdit({ raw: {} }, 'notes.md');
    expect(fm.title).toBe('notes.md');
    expect(fm.status).toBe('draft');
    expect(fm.tags).toBe('');
  });
});
