import { AppError } from '../../../domain/errors.js';
import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../services/ToolExecutionContext.js';
import { AgentUploadService } from '../../../services/agents/AgentUploadService.js';
import { DEFAULT_READ_UPLOAD_MAX_BYTES } from '../../../services/agents/userTurnRuntime.js';
import { BaseTool } from '../../base/BaseTool.js';

export class ReadUploadTool extends BaseTool {
  readonly id = 'read_upload';
  readonly name = 'readUpload';
  readonly displayName = '读取上传附件';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '读取当前用户轮次上传的非图片附件内容。用户消息中附带文件且需分析其内容时调用。' +
    '必填：fileId（来自当前轮次附件列表）；可选 maxBytes（默认 524288）。工具调用名：readUpload。图片附件不可用此工具。';
  readonly parameters = {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'Upload file id from the current turn attachment list',
      },
      maxBytes: {
        type: 'number',
        description: 'Maximum bytes to read (default 524288)',
      },
    },
    required: ['fileId'],
  };

  async handler(
    args: { fileId?: string; maxBytes?: number },
    toolCtx?: ToolExecutionContext,
  ) {
    const context = requireToolContext(toolCtx, this.id);
    const fileId = typeof args?.fileId === 'string' ? args.fileId.trim() : '';
    if (!fileId) {
      throw new AppError(400, 'fileId is required');
    }

    const allowlist = context.uploadAllowlist;
    if (!allowlist?.agentId) {
      throw new AppError(403, 'No upload allowlist is configured for this run');
    }
    if (!allowlist.fileIds.has(fileId)) {
      throw new AppError(403, `无权读取该文件: ${fileId}`);
    }

    const maxBytes =
      typeof args.maxBytes === 'number' && Number.isFinite(args.maxBytes) && args.maxBytes > 0
        ? Math.floor(args.maxBytes)
        : DEFAULT_READ_UPLOAD_MAX_BYTES;

    const uploadService = new AgentUploadService(context.store);
    const payload = await uploadService.readContent(allowlist.agentId, fileId, maxBytes);

    return {
      fileId,
      name: payload.name,
      mime: payload.mime,
      encoding: payload.encoding,
      size: payload.size,
      truncated: payload.truncated,
      content: payload.content,
    };
  }
}
