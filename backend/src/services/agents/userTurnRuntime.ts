import fs from 'fs/promises';
import type { AgentDefinition } from '../../types/agent.js';
import type { AIProviderConfig } from '../../types/config.js';
import type { AIMessage, AIMessageContentPart } from '../../types/index.js';
import { LogService } from '../LogService.js';
import type { AgentMessageContentPart } from './engine/AgentRunSpec.js';
import type { AgentUploadService } from './AgentUploadService.js';
import type { ChatFileItem, ChatImageItem, UserTurnMessageMetadata } from './userTurnPayload.js';

export const READ_UPLOAD_TOOL_ID = 'read_upload';
export const DEFAULT_READ_UPLOAD_MAX_BYTES = 524_288;

export const ATTACHED_FILES_INDEX_HEADER = '[Attached files available via read_upload]';

const ATTACHED_FILES_INDEX_RE =
  /\n\n\[Attached files available via read_upload\]\n(?:- [^\n]+\n?)*/;

export function buildAttachedFilesIndex(fileList: ChatFileItem[]): string {
  if (fileList.length === 0) return '';
  const lines = fileList.map(
    (file) => `- ${file.name} (fileId: ${file.id}, ${file.fileType}, ${file.size} bytes)`,
  );
  return `\n\n${ATTACHED_FILES_INDEX_HEADER}\n${lines.join('\n')}`;
}

/** Strip runtime-only file index from persisted or display text. */
export function stripAttachedFilesIndexFromText(text: string): string {
  return text.replace(ATTACHED_FILES_INDEX_RE, '').trim();
}

export function buildVisionFallbackMarkdown(imageList: ChatImageItem[]): string {
  return imageList.map((image) => `![${image.alt}](${image.url})`).join('\n');
}

export function appendUserTurnRuntimeText(
  message: string,
  fileList: ChatFileItem[] | undefined,
  dynamicSuffix?: string,
): string {
  const base = [message.trim(), buildAttachedFilesIndex(fileList ?? [])]
    .filter((part) => part.length > 0)
    .join('');
  if (!dynamicSuffix?.trim()) return base;
  return base ? `${base}\n\n${dynamicSuffix.trim()}` : dynamicSuffix.trim();
}

export function resolveSupportsVision(
  agentDef: AgentDefinition,
  providerConfig?: AIProviderConfig,
): boolean {
  const model = String(agentDef.model || '').trim();
  if (!model) return false;

  const capabilities =
    providerConfig?.modelCapabilities?.[model] ??
    providerConfig?.modelCapabilities?.[model.toLowerCase()];
  return Array.isArray(capabilities) && capabilities.includes('vision');
}

export function readUserTurnMetadata(metadata: Record<string, unknown> | undefined): {
  fileList: ChatFileItem[];
  imageList: ChatImageItem[];
  format?: UserTurnMessageMetadata['format'];
} {
  if (!metadata) return { fileList: [], imageList: [] };
  return {
    fileList: normalizeChatFileList(metadata.fileList),
    imageList: normalizeChatImageList(metadata.imageList),
    format: metadata.format === 'markdown' || metadata.format === 'text' ? metadata.format : undefined,
  };
}

export async function buildRuntimeUserContent(input: {
  message: string;
  fileList?: ChatFileItem[];
  imageList?: ChatImageItem[];
  dynamicSuffix?: string;
  supportsVision: boolean;
  uploadService?: AgentUploadService;
}): Promise<AIMessage['content']> {
  const textBody = appendUserTurnRuntimeText(input.message, input.fileList, input.dynamicSuffix);
  const imageList = input.imageList ?? [];

  if (imageList.length === 0) {
    return textBody;
  }

  if (!input.supportsVision) {
    LogService.warn(
      '[UserTurn] Model does not support vision; degrading image attachments to markdown links',
    );
    const fallback = buildVisionFallbackMarkdown(imageList);
    return [textBody, fallback].filter(Boolean).join('\n\n');
  }

  if (!input.uploadService) {
    LogService.warn('[UserTurn] Upload service unavailable; degrading images to markdown links');
    const fallback = buildVisionFallbackMarkdown(imageList);
    return [textBody, fallback].filter(Boolean).join('\n\n');
  }

  const imageParts = await loadVisionImageParts(imageList, input.uploadService);
  if (imageParts.length === 0) {
    return textBody;
  }

  const parts: AIMessageContentPart[] = [];
  if (textBody) {
    parts.push({ type: 'text', text: textBody });
  }
  parts.push(...imageParts);
  return parts;
}

export async function loadVisionImageParts(
  imageList: ChatImageItem[],
  uploadService: AgentUploadService,
  readFileFn: (absolutePath: string) => Promise<Buffer> = (absolutePath) =>
    fs.readFile(absolutePath),
): Promise<AIMessageContentPart[]> {
  const parts: AIMessageContentPart[] = [];

  for (const image of imageList) {
    try {
      const { record, absolutePath } = await uploadService.getUploadFile(image.id);
      const buffer = await readFileFn(absolutePath);
      const base64 = buffer.toString('base64');
      parts.push({
        type: 'image_url',
        image_url: {
          url: `data:${record.mime};base64,${base64}`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      LogService.warn(`[UserTurn] Failed to load image ${image.id} for vision: ${message}`);
      parts.push({
        type: 'text',
        text: buildVisionFallbackMarkdown([image]),
      });
    }
  }

  return parts;
}

export function runtimeMessagePlainText(content: AIMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : String(content);
  return content
    .map((part) => {
      if (part.type === 'text') return part.text ?? '';
      if (part.type === 'image_url') {
        const url = part.image_url?.url ?? '';
        return url ? `![image](${url})` : '';
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

export function collectUploadAllowlistFileIds(
  currentFileList: ChatFileItem[] | undefined,
): Set<string> {
  return new Set((currentFileList ?? []).map((file) => file.id).filter(Boolean));
}

function normalizeChatFileList(value: unknown): ChatFileItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const name = typeof record.name === 'string' ? record.name : '';
    const fileType = typeof record.fileType === 'string' ? record.fileType : 'application/octet-stream';
    const size = typeof record.size === 'number' ? record.size : 0;
    const url = typeof record.url === 'string' ? record.url : '';
    if (!id || !name) return [];
    return [{ fileType, id, name, size, url }];
  });
}

export function runtimeMessageToPersistedContent(content: AIMessage['content']): string {
  return runtimeMessagePlainText(content);
}

export function runtimeMessageToAgentContent(
  content: AIMessage['content'],
): string | AgentMessageContentPart[] {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part): AgentMessageContentPart => {
    if (part.type === 'text') {
      return { kind: 'text', text: part.text };
    }
    const url = part.image_url?.url ?? '';
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/.exec(url);
    if (dataUrlMatch) {
      return {
        kind: 'image',
        mimeType: dataUrlMatch[1],
        data: dataUrlMatch[2],
      };
    }
    return {
      kind: 'text',
      text: url ? `![image](${url})` : '',
    };
  });
}

function normalizeChatImageList(value: unknown): ChatImageItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const alt = typeof record.alt === 'string' ? record.alt : 'image';
    const url = typeof record.url === 'string' ? record.url : '';
    if (!id) return [];
    return [{ alt, id, url }];
  });
}
