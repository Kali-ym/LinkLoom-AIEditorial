import { describe, expect, it, vi } from 'vitest';

import type { AgentUploadService } from '../src/services/agents/AgentUploadService.js';
import {
  appendUserTurnRuntimeText,
  buildAttachedFilesIndex,
  buildRuntimeUserContent,
  collectUploadAllowlistFileIds,
  loadVisionImageParts,
  resolveSupportsVision,
  runtimeMessagePlainText,
  stripAttachedFilesIndexFromText,
} from '../src/services/agents/userTurnRuntime.js';

describe('userTurnRuntime', () => {
  it('appends non-image file index for read_upload', () => {
    const text = appendUserTurnRuntimeText('hello', [
      {
        fileType: 'application/pdf',
        id: 'file-1',
        name: 'report.pdf',
        size: 1024,
        url: '/api/agent-uploads/file-1',
      },
    ]);
    expect(text).toContain('[Attached files available via read_upload]');
    expect(text).toContain('report.pdf (fileId: file-1, application/pdf, 1024 bytes)');
  });

  it('builds vision content parts when supported', async () => {
    const uploadService = {
      getUploadFile: vi.fn(async () => ({
        record: { mime: 'image/png' },
        absolutePath: '/tmp/test.png',
      })),
    } as unknown as AgentUploadService;

    const parts = await loadVisionImageParts(
      [{ alt: 'shot.png', id: 'img-1', url: '/api/agent-uploads/img-1' }],
      uploadService,
      async () => Buffer.from('png-bytes'),
    );

    expect(parts).toEqual([
      expect.objectContaining({
        type: 'image_url',
        image_url: { url: expect.stringContaining('data:image/png;base64,') },
      }),
    ]);
  });

  it('degrades images to markdown when vision is unsupported', async () => {
    const uploadService = {} as AgentUploadService;
    const content = await buildRuntimeUserContent({
      message: 'describe this',
      imageList: [{ alt: 'shot.png', id: 'img-1', url: '/api/agent-uploads/img-1' }],
      supportsVision: false,
      uploadService,
    });
    expect(content).toContain('![shot.png](/api/agent-uploads/img-1)');
  });

  it('detects vision capability from provider modelCapabilities', () => {
    expect(
      resolveSupportsVision(
        { id: 'a', name: 'A', model: 'gpt-4o-mini', providerId: 'openai', systemPrompt: '' },
        { id: 'openai', name: 'OpenAI', type: 'OPENAI', models: [], modelCapabilities: { 'gpt-4o-mini': ['vision'] } },
      ),
    ).toBe(true);
  });

  it('does not infer vision without provider modelCapabilities', () => {
    expect(
      resolveSupportsVision(
        { id: 'a', name: 'A', model: 'gpt-5.5', providerId: 'openai', systemPrompt: '' },
        { id: 'openai', name: 'OpenAI', type: 'OPENAI', models: [] },
      ),
    ).toBe(false);
  });

  it('collects upload allowlist ids from current turn fileList', () => {
    expect(
      collectUploadAllowlistFileIds([
        {
          fileType: 'application/pdf',
          id: 'file-1',
          name: 'a.pdf',
          size: 1,
          url: '/u/1',
        },
      ]),
    ).toEqual(new Set(['file-1']));
  });

  it('flattens multimodal runtime content to plain text', () => {
    expect(
      runtimeMessagePlainText([
        { type: 'text', text: 'hello' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
      ]),
    ).toContain('hello');
  });

  it('builds attached files index section', () => {
    expect(
      buildAttachedFilesIndex([
        {
          fileType: 'text/plain',
          id: 'f1',
          name: 'notes.txt',
          size: 12,
          url: '/u/f1',
        },
      ]),
    ).toContain('notes.txt (fileId: f1, text/plain, 12 bytes)');
  });

  it('strips runtime-only attached files index from display text', () => {
    const runtimeText = appendUserTurnRuntimeText('你能看到这个文件吗', [
      {
        fileType: 'application/pdf',
        id: 'file-1',
        name: 'report.pdf',
        size: 1024,
        url: '/api/agent-uploads/file-1',
      },
    ]);
    expect(stripAttachedFilesIndexFromText(runtimeText)).toBe('你能看到这个文件吗');
  });
});
