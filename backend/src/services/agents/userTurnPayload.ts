import { AppError } from '../../domain/errors.js';

export interface FileRef {
  fileId: string;
  name?: string;
  mimeType?: string;
  size?: number;
  url?: string;
}

export interface ChatImageItem {
  alt: string;
  id: string;
  url: string;
}

export interface ChatFileItem {
  fileType: string;
  id: string;
  name: string;
  size: number;
  url: string;
}

export interface DerivedEditorTags {
  commands?: Array<{ category: string; label: string; type: string }>;
  mentionedAgents?: string[];
  selectedSkills?: string[];
  selectedTools?: string[];
}

/** Metadata persisted on the turn user message (§ UserTurn V2). */
export interface UserTurnMessageMetadata {
  derived?: DerivedEditorTags;
  editorData?: Record<string, unknown>;
  fileList?: ChatFileItem[];
  format: 'markdown' | 'text';
  imageList?: ChatImageItem[];
}

export interface NormalizedUserTurn {
  editorData?: Record<string, unknown>;
  files: FileRef[];
  message: string;
}

export interface ResolvedUserTurnFiles {
  fileList: ChatFileItem[];
  imageList: ChatImageItem[];
}

/** Rejects removed V2-compat fields on POST /api/agent-runs (PR-6). */
export function assertNoDeprecatedUserTurnFields(body: unknown): void {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if ('input' in record && record.input !== undefined) {
    throw new AppError(400, 'Deprecated field: use `message` instead of `input`');
  }
  if ('attachments' in record && record.attachments !== undefined) {
    throw new AppError(400, 'Deprecated field: use `files` instead of `attachments`');
  }
}

/** PATCH message body — accepts V2 fields or legacy `{ content }`. */
export function normalizeEditUserMessageBody(body: unknown): NormalizedUserTurn {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (typeof record.content === 'string' && typeof record.message !== 'string') {
    return normalizeUserTurnBody({ ...record, message: record.content });
  }
  return normalizeUserTurnBody(body);
}

export function fileRefsFromChatItems(
  imageList: ChatImageItem[],
  fileList: ChatFileItem[],
): FileRef[] {
  const refs: FileRef[] = [];
  for (const image of imageList) {
    refs.push({
      fileId: image.id,
      name: image.alt,
      url: image.url,
    });
  }
  for (const file of fileList) {
    refs.push({
      fileId: file.id,
      mimeType: file.fileType,
      name: file.name,
      size: file.size,
      url: file.url,
    });
  }
  return refs;
}

export function normalizeUserTurnBody(body: unknown): NormalizedUserTurn {
  assertNoDeprecatedUserTurnFields(body);
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  const message =
    typeof record.message === 'string'
      ? record.message
      : typeof record.prompt === 'string'
        ? record.prompt
        : '';

  const editorData =
    record.editorData && typeof record.editorData === 'object'
      ? (record.editorData as Record<string, unknown>)
      : undefined;

  const files = normalizeFileRefs(record.files);

  if (!message.trim() && files.length === 0) {
    throw new AppError(400, 'message or files is required');
  }

  return { editorData, files, message };
}

export function normalizeFileRefs(value: unknown): FileRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const fileId =
      typeof record.fileId === 'string'
        ? record.fileId.trim()
        : typeof record.id === 'string'
          ? record.id.trim()
          : '';
    if (!fileId) return [];
    return [
      {
        fileId,
        mimeType:
          typeof record.mimeType === 'string'
            ? record.mimeType
            : typeof record.mime === 'string'
              ? record.mime
              : undefined,
        name: typeof record.name === 'string' ? record.name : undefined,
        size: typeof record.size === 'number' ? record.size : undefined,
        url:
          typeof record.url === 'string'
            ? record.url
            : typeof record.uri === 'string'
              ? record.uri
              : undefined,
      },
    ];
  });
}

export function buildFilesOnlyPrompt(imageList: ChatImageItem[], fileList: ChatFileItem[]): string {
  const names = [
    ...imageList.map((item) => item.alt).filter(Boolean),
    ...fileList.map((item) => item.name).filter(Boolean),
  ];
  return names.join('、') || '附件';
}

const UPLOAD_MARKDOWN_IMAGE_RE =
  /!\[[^\]]*\]\((?:blob:[^)]*|[^)]*\/api\/agent-uploads\/[^)]*)\)/gi;

export function stripUploadMediaFromMarkdown(message: string): string {
  return message.replace(UPLOAD_MARKDOWN_IMAGE_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function sanitizeUserTurnMessageForImages(
  message: string,
  imageList: ChatImageItem[],
): string {
  if (!message.trim() || imageList.length === 0) return message;
  return stripUploadMediaFromMarkdown(message);
}

export function buildUserTurnMessageMetadata(input: {
  editorData?: Record<string, unknown>;
  fileList: ChatFileItem[];
  imageList: ChatImageItem[];
  message: string;
}): UserTurnMessageMetadata {
  const hasMarkdownHints = /[*_`#[\]<]/.test(input.message);
  return {
    derived: parseDerivedEditorTags(input.editorData),
    editorData: input.editorData,
    fileList: input.fileList.length > 0 ? input.fileList : undefined,
    format: input.editorData || hasMarkdownHints ? 'markdown' : 'text',
    imageList: input.imageList.length > 0 ? input.imageList : undefined,
  };
}

export function parseDerivedEditorTags(
  editorData: Record<string, unknown> | undefined,
): DerivedEditorTags | undefined {
  if (!editorData) return undefined;

  const tags: Array<{ category: string; label: string; type: string }> = [];
  walkEditorNode(editorData.root, tags);

  const selectedSkills = unique(
    tags.filter((tag) => tag.category === 'skill' || tag.category === 'agentSkill').map((t) => t.type),
  );
  const selectedTools = unique(tags.filter((tag) => tag.category === 'tool').map((t) => t.type));
  const mentionedAgents = unique(
    tags.filter((tag) => tag.category === 'agent' || tag.category === 'mention').map((t) => t.type),
  );
  const commands = tags.filter((tag) => tag.category === 'command');

  if (
    selectedSkills.length === 0 &&
    selectedTools.length === 0 &&
    mentionedAgents.length === 0 &&
    commands.length === 0
  ) {
    return undefined;
  }

  return {
    ...(commands.length > 0 ? { commands } : {}),
    ...(mentionedAgents.length > 0 ? { mentionedAgents } : {}),
    ...(selectedSkills.length > 0 ? { selectedSkills } : {}),
    ...(selectedTools.length > 0 ? { selectedTools } : {}),
  };
}

function walkEditorNode(
  node: unknown,
  out: Array<{ category: string; label: string; type: string }>,
): void {
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;

  if (record.type === 'action-tag') {
    out.push({
      category: String(record.actionCategory ?? ''),
      label: String(record.actionLabel ?? ''),
      type: String(record.actionType ?? ''),
    });
  }

  const children = record.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      walkEditorNode(child, out);
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

const SKILL_TAG_NAME_RE = /<skill\s+[^>]*\bname="([^"]+)"[^>]*\/?>/gi;

/** Parse `<skill name="…" />` tags from persisted user message markdown. */
export function parseSkillNamesFromMessage(message: string): string[] {
  const ids: string[] = [];
  for (const match of message.matchAll(SKILL_TAG_NAME_RE)) {
    const name = match[1]?.trim();
    if (name) ids.push(name);
  }
  return unique(ids);
}

/** Skill ids active for one user turn: agent-bound + editor tags + inline skill markup. */
export function resolveTurnSkillIds(input: {
  agentSkillIds?: string[];
  message?: string;
  userTurnMetadata?: UserTurnMessageMetadata;
}): string[] {
  const fromAgent = input.agentSkillIds ?? [];
  const fromTags = input.userTurnMetadata?.derived?.selectedSkills ?? [];
  const fromMessage = input.message ? parseSkillNamesFromMessage(input.message) : [];
  return unique([...fromAgent, ...fromTags, ...fromMessage]);
}

export function uploadUrlFor(fileId: string): string {
  return `/api/agent-uploads/${encodeURIComponent(fileId)}`;
}

export function classifyUploadMime(mime: string): 'image' | 'file' {
  return mime.trim().toLowerCase().startsWith('image/') ? 'image' : 'file';
}
