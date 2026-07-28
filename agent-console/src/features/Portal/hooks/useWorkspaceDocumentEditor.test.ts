import { describe, expect, it } from 'vitest';

import { formatWorkspaceDocumentSaveLabel } from './workspaceDocumentSaveLabel';

describe('formatWorkspaceDocumentSaveLabel', () => {
  it('returns readonly label when not editable', () => {
    expect(formatWorkspaceDocumentSaveLabel('idle', false)).toBe('只读预览');
  });

  it('returns saving label', () => {
    expect(formatWorkspaceDocumentSaveLabel('saving', true)).toBe('保存中…');
  });

  it('returns saved label', () => {
    expect(formatWorkspaceDocumentSaveLabel('saved', true)).toBe('已自动保存 · 刚刚');
  });

  it('returns conflict label', () => {
    expect(formatWorkspaceDocumentSaveLabel('conflict', true)).toBe('磁盘已更新，请重新加载');
  });
});
