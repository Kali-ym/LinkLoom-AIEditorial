import { describe, expect, it } from 'vitest';

import { AppError } from '../src/domain/errors.js';
import {
  buildUserTurnMessageMetadata,
  sanitizeUserTurnMessageForImages,
  fileRefsFromChatItems,
  normalizeEditUserMessageBody,
  normalizeFileRefs,
  normalizeUserTurnBody,
  parseDerivedEditorTags,
  parseSkillNamesFromMessage,
  resolveTurnSkillIds,
} from '../src/services/agents/userTurnPayload.js';

describe('userTurnPayload', () => {
  it('uses message as the user turn body', () => {
    expect(normalizeUserTurnBody({ message: '**hi**' }).message).toBe('**hi**');
  });

  it('rejects deprecated input alias (PR-6)', () => {
    expect(() => normalizeUserTurnBody({ input: 'plain' })).toThrow(AppError);
    expect(() => normalizeUserTurnBody({ input: 'plain' })).toThrow(/`message` instead of `input`/);
  });

  it('rejects deprecated attachments field (PR-6)', () => {
    expect(() =>
      normalizeUserTurnBody({
        message: 'hello',
        attachments: [{ id: 'file-1', name: 'a.txt', mimeType: 'text/plain' }],
      }),
    ).toThrow(/`files` instead of `attachments`/);
  });

  it('rejects empty message without files', () => {
    expect(() => normalizeUserTurnBody({ message: '   ' })).toThrow(AppError);
  });

  it('allows files-only turns', () => {
    expect(
      normalizeUserTurnBody({
        files: [{ fileId: 'file-1', name: 'a.pdf', mimeType: 'application/pdf' }],
      }).files,
    ).toHaveLength(1);
  });

  it('parses inline skill tags from message markdown', () => {
    expect(
      parseSkillNamesFromMessage('<skill name="daily-one-x" label="daily-one-x" /> 简述一下'),
    ).toEqual(['daily-one-x']);
  });

  it('merges agent-bound, editor, and inline skill ids for a turn', () => {
    expect(
      resolveTurnSkillIds({
        agentSkillIds: ['memory-read'],
        message: '<skill name="daily-one-x" label="daily-one-x" /> 简述一下',
        userTurnMetadata: {
          format: 'markdown',
          derived: { selectedSkills: ['github'] },
        },
      }),
    ).toEqual(['memory-read', 'github', 'daily-one-x']);
  });

  it('parses action tags from editorData', () => {
    const derived = parseDerivedEditorTags({
      root: {
        children: [
          {
            type: 'action-tag',
            actionCategory: 'skill',
            actionType: 'github',
            actionLabel: 'GitHub',
          },
          {
            type: 'action-tag',
            actionCategory: 'command',
            actionType: 'compact',
            actionLabel: 'Compact',
          },
        ],
      },
    });
    expect(derived?.selectedSkills).toEqual(['github']);
    expect(derived?.commands).toEqual([
      { category: 'command', label: 'Compact', type: 'compact' },
    ]);
  });

  it('strips inline markdown images when image attachments exist', () => {
    expect(
      sanitizeUserTurnMessageForImages(
        '思考并回答图中问题\n\n![img](blob:http://localhost/abc)',
        [{ alt: 'shot', id: 'i1', url: '/api/agent-uploads/i1' }],
      ),
    ).toBe('思考并回答图中问题');
  });

  it('keeps external markdown images when sanitizing upload attachments', () => {
    const markdown = 'see ![diagram](https://example.com/a.png)';
    expect(
      sanitizeUserTurnMessageForImages(markdown, [
        { alt: 'shot', id: 'i1', url: '/api/agent-uploads/i1' },
      ]),
    ).toBe(markdown);
  });

  it('builds persisted metadata with markdown format when editorData exists', () => {
    const metadata = buildUserTurnMessageMetadata({
      message: 'hello',
      editorData: { root: { children: [] } },
      fileList: [
        { fileType: 'application/pdf', id: 'f1', name: 'a.pdf', size: 10, url: '/u/f1' },
      ],
      imageList: [{ alt: 'pic', id: 'i1', url: '/u/i1' }],
    });
    expect(metadata.format).toBe('markdown');
    expect(metadata.fileList).toHaveLength(1);
    expect(metadata.imageList).toHaveLength(1);
  });

  it('normalizes file refs from id and mime aliases', () => {
    expect(
      normalizeFileRefs([{ id: 'x', mime: 'text/plain', uri: 'http://x' }]),
    ).toEqual([{ fileId: 'x', mimeType: 'text/plain', url: 'http://x' }]);
  });

  it('normalizes legacy edit body content field', () => {
    expect(normalizeEditUserMessageBody({ content: 'edited' }).message).toBe('edited');
  });

  it('rebuilds file refs from persisted chat items', () => {
    expect(
      fileRefsFromChatItems(
        [{ alt: 'pic', id: 'img-1', url: '/u/img-1' }],
        [{ fileType: 'application/pdf', id: 'doc-1', name: 'a.pdf', size: 9, url: '/u/doc-1' }],
      ),
    ).toEqual([
      { fileId: 'img-1', name: 'pic', url: '/u/img-1' },
      {
        fileId: 'doc-1',
        mimeType: 'application/pdf',
        name: 'a.pdf',
        size: 9,
        url: '/u/doc-1',
      },
    ]);
  });
});
