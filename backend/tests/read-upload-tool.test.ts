import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../src/domain/errors.js';
import { ReadUploadTool } from '../src/plugins/builtin/tools/ReadUploadTool.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const mockReadContent = vi.fn();

vi.mock('../src/services/agents/AgentUploadService.js', () => ({
  AgentUploadService: class MockAgentUploadService {
    readContent = mockReadContent;
  },
}));

function createCtx(fileIds: string[]): ToolExecutionContext {
  return {
    store: {} as ToolExecutionContext['store'],
    settings: {} as ToolExecutionContext['settings'],
    taskService: {} as ToolExecutionContext['taskService'],
    agentService: null,
    logger: console as unknown as ToolExecutionContext['logger'],
    auditLogger: {} as ToolExecutionContext['auditLogger'],
    services: {} as ToolExecutionContext['services'],
    uploadAllowlist: {
      agentId: 'agent-1',
      fileIds: new Set(fileIds),
    },
  };
}

describe('ReadUploadTool', () => {
  it('reads allowed upload content', async () => {
    mockReadContent.mockResolvedValueOnce({
      content: 'hello world',
      encoding: 'utf-8',
      mime: 'text/plain',
      name: 'notes.txt',
      size: 11,
      truncated: false,
    });

    const tool = new ReadUploadTool();
    const result = await tool.handler({ fileId: 'file-1' }, createCtx(['file-1']));

    expect(mockReadContent).toHaveBeenCalledWith('agent-1', 'file-1', 524288);
    expect(result).toMatchObject({
      fileId: 'file-1',
      encoding: 'utf-8',
      content: 'hello world',
    });
  });

  it('rejects file ids outside the current turn allowlist', async () => {
    const tool = new ReadUploadTool();
    await expect(tool.handler({ fileId: 'file-2' }, createCtx(['file-1']))).rejects.toThrow(AppError);
    await expect(tool.handler({ fileId: 'file-2' }, createCtx(['file-1']))).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
