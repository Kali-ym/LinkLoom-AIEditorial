// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import {
  mapBackendUploadToRef,
  mapChatAttachmentRefsToFileRefs,
} from './upload';

describe('upload mappers', () => {
  it('maps backend upload dto to ChatAttachmentRef', () => {
    localStorage.setItem(
      'console_connection',
      JSON.stringify({
        baseUrl: 'http://localhost:3000',
        apiKey: 'sk_pf_test',
        connectedAt: '2026-07-28T00:00:00.000Z',
      }),
    );
    const ref = mapBackendUploadToRef({
      uploadId: 'aupl_1',
      fileId: 'aupl_1',
      name: 'note.txt',
      mime: 'text/plain',
      mimeType: 'text/plain',
      size: 12,
      url: '/api/agent-uploads/aupl_1',
    });
    expect(ref).toEqual({
      uploadId: 'aupl_1',
      fileId: 'aupl_1',
      name: 'note.txt',
      mime: 'text/plain',
      size: 12,
      url: 'http://localhost:3000/api/agent-uploads/aupl_1',
    });
  });

  it('maps ChatAttachmentRef list to FileRef payload', () => {
    const payload = mapChatAttachmentRefsToFileRefs([
      {
        uploadId: 'aupl_1',
        name: 'note.txt',
        mime: 'text/plain',
        size: 12,
        url: 'http://localhost:3000/api/agent-uploads/aupl_1',
      },
    ]);
    expect(payload).toEqual([
      {
        fileId: 'aupl_1',
        name: 'note.txt',
        mimeType: 'text/plain',
        size: 12,
        url: 'http://localhost:3000/api/agent-uploads/aupl_1',
      },
    ]);
  });
});
