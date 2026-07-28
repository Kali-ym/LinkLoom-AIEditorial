import { describe, expect, it } from 'vitest';

import {
  stripAttachedFilesIndexFromMarkdown,
  stripEmbedMediaFromEditorData,
  stripUploadMediaFromMarkdown,
} from './uploadMessageContent';

describe('uploadMessageContent', () => {
  it('strips blob and agent-upload markdown images', () => {
    expect(
      stripUploadMediaFromMarkdown(
        '思考并回答图中问题\n\n![paste](blob:http://localhost/abc)\n\n![shot](/api/agent-uploads/img-1)',
      ),
    ).toBe('思考并回答图中问题');
  });

  it('keeps external image markdown links', () => {
    const markdown = 'see ![diagram](https://example.com/a.png)';
    expect(stripUploadMediaFromMarkdown(markdown)).toBe(markdown);
  });

  it('strips runtime-only attached files index from markdown', () => {
    expect(
      stripAttachedFilesIndexFromMarkdown(
        '你能看到这个文件吗\n\n[Attached files available via read_upload]\n- report.pdf (fileId: file-1, application/pdf, 1024 bytes)',
      ),
    ).toBe('你能看到这个文件吗');
  });

  it('removes embedded media nodes from editor JSON', () => {
    const stripped = stripEmbedMediaFromEditorData({
      root: {
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'hello' }] },
          { type: 'image', src: 'blob:abc' },
        ],
        type: 'root',
      },
    });

    expect(stripped?.root).toEqual({
      children: [{ type: 'paragraph', children: [{ type: 'text', text: 'hello' }] }],
      type: 'root',
    });
  });
});
