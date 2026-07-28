import { describe, expect, it } from 'vitest';

import {
  buildFilesOnlyPrompt,
  buildUserTurnMessageMetadata,
  fileRefsFromChatItems,
  normalizeEditUserMessageBody,
} from '../src/services/agents/userTurnPayload.js';

describe('session message edit (UserTurn V2)', () => {
  it('accepts V2 edit body and legacy content alias', () => {
    expect(
      normalizeEditUserMessageBody({
        message: '**edited**',
        editorData: { root: { children: [] } },
        files: [{ fileId: 'doc-1', name: 'a.pdf' }],
      }),
    ).toMatchObject({
      message: '**edited**',
      files: [{ fileId: 'doc-1', name: 'a.pdf' }],
    });

    expect(normalizeEditUserMessageBody({ content: 'legacy' }).message).toBe('legacy');
  });

  it('builds persisted metadata for edited turns with attachments', () => {
    const imageList = [{ alt: 'shot.png', id: 'img-1', url: '/api/agent-uploads/img-1' }];
    const fileList = [
      {
        fileType: 'application/pdf',
        id: 'doc-1',
        name: 'report.pdf',
        size: 1024,
        url: '/api/agent-uploads/doc-1',
      },
    ];

    const metadata = buildUserTurnMessageMetadata({
      message: '请总结',
      editorData: { root: { children: [] } },
      imageList,
      fileList,
    });

    expect(metadata.format).toBe('markdown');
    expect(metadata.imageList).toEqual(imageList);
    expect(metadata.fileList).toEqual(fileList);
  });

  it('round-trips file refs for edit save and regenerate', () => {
    const imageList = [{ alt: 'pic', id: 'img-1', url: '/u/img-1' }];
    const fileList = [
      { fileType: 'text/plain', id: 'txt-1', name: 'note.txt', size: 4, url: '/u/txt-1' },
    ];
    const files = fileRefsFromChatItems(imageList, fileList);
    expect(files.map((file) => file.fileId)).toEqual(['img-1', 'txt-1']);
  });

  it('uses files-only prompt when message is empty but files exist', () => {
    const imageList = [{ alt: 'a.png', id: 'img-1', url: '/u/img-1' }];
    const fileList = [
      { fileType: 'application/pdf', id: 'doc-1', name: 'b.pdf', size: 1, url: '/u/doc-1' },
    ];
    expect(buildFilesOnlyPrompt(imageList, fileList)).toBe('a.png、b.pdf');
  });
});
