import { describe, expect, it } from 'vitest';

import {
  attachmentIdsEqual,
  buildFilesOnlyPromptFromRefs,
  mapChatAttachmentRefToFileRef,
  mapMessageAttachmentsToChatRefs,
  mapMessageAttachmentsToFileRefs,
  mapRefsToMessageAttachments,
} from './userTurnAttachments';

describe('userTurnAttachments', () => {
  it('maps attachment ref to FileRef', () => {
    expect(
      mapChatAttachmentRefToFileRef({
        uploadId: 'f1',
        name: 'note.txt',
        mime: 'text/plain',
        size: 12,
        url: 'http://localhost/api/agent-uploads/f1',
      }),
    ).toEqual({
      fileId: 'f1',
      mimeType: 'text/plain',
      name: 'note.txt',
      size: 12,
      url: 'http://localhost/api/agent-uploads/f1',
    });
  });

  it('splits refs into imageList and fileList for optimistic bubbles', () => {
    const { imageList, fileList } = mapRefsToMessageAttachments([
      {
        uploadId: 'img-1',
        name: 'photo.png',
        mime: 'image/png',
        size: 100,
        url: '/api/agent-uploads/img-1',
        previewUrl: 'blob:preview',
      },
      {
        uploadId: 'doc-1',
        name: 'report.pdf',
        mime: 'application/pdf',
        size: 200,
        url: '/api/agent-uploads/doc-1',
      },
    ]);

    expect(imageList).toEqual([
      { alt: 'photo.png', id: 'img-1', url: 'blob:preview' },
    ]);
    expect(fileList).toEqual([
      {
        fileType: 'application/pdf',
        id: 'doc-1',
        name: 'report.pdf',
        size: 200,
        url: '/api/agent-uploads/doc-1',
      },
    ]);
  });

  it('builds files-only prompt from attachment names', () => {
    expect(
      buildFilesOnlyPromptFromRefs([
        {
          uploadId: 'a',
          name: 'a.png',
          mime: 'image/png',
          size: 1,
          url: '/a',
        },
        {
          uploadId: 'b',
          name: 'b.pdf',
          mime: 'application/pdf',
          size: 2,
          url: '/b',
        },
      ]),
    ).toBe('a.png、b.pdf');
  });

  it('round-trips message attachments to chat refs and file refs', () => {
    const refs = mapMessageAttachmentsToChatRefs(
      [{ alt: 'shot.png', id: 'img-1', url: '/api/agent-uploads/img-1' }],
      [
        {
          fileType: 'application/pdf',
          id: 'doc-1',
          name: 'report.pdf',
          size: 42,
          url: '/api/agent-uploads/doc-1',
        },
      ],
    );
    expect(refs).toHaveLength(2);
    expect(mapMessageAttachmentsToFileRefs(
      [{ alt: 'shot.png', id: 'img-1', url: '/api/agent-uploads/img-1' }],
      [
        {
          fileType: 'application/pdf',
          id: 'doc-1',
          name: 'report.pdf',
          size: 42,
          url: '/api/agent-uploads/doc-1',
        },
      ],
    )).toEqual([
      { fileId: 'img-1', mimeType: 'image/*', name: 'shot.png', url: '/api/agent-uploads/img-1', size: 0 },
      {
        fileId: 'doc-1',
        mimeType: 'application/pdf',
        name: 'report.pdf',
        size: 42,
        url: '/api/agent-uploads/doc-1',
      },
    ]);
  });

  it('compares attachment id sets for edit dirty checks', () => {
    const left = mapMessageAttachmentsToChatRefs(
      [{ id: 'a', url: '/a' }],
      [{ id: 'b', name: 'b.pdf', fileType: 'application/pdf' }],
    );
    const right = mapMessageAttachmentsToChatRefs(
      [{ id: 'a', url: '/a' }],
      [{ id: 'b', name: 'b.pdf', fileType: 'application/pdf' }],
    );
    expect(attachmentIdsEqual(left, right)).toBe(true);
    expect(
      attachmentIdsEqual(left, mapMessageAttachmentsToChatRefs([{ id: 'c', url: '/c' }], [])),
    ).toBe(false);
  });
});
