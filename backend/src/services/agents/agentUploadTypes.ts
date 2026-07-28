export interface AgentUploadRecord {
  id: string;
  agentId: string;
  name: string;
  mime: string;
  size: number;
  storagePath: string;
  createdAt: number;
}

export interface AgentUploadDto {
  uploadId: string;
  fileId: string;
  name: string;
  mime: string;
  mimeType: string;
  size: number;
  url: string;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = ['image/', 'text/', 'video/'] as const;
const ALLOWED_MIME_EXACT = new Set(['application/pdf', 'application/json']);

export function isAllowedUploadMime(mime: string): boolean {
  const normalized = mime.trim().toLowerCase() || 'application/octet-stream';
  if (ALLOWED_MIME_EXACT.has(normalized)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function assertUploadSize(size: number): void {
  if (size <= 0) {
    throw new Error('upload file is empty');
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error(`upload exceeds ${MAX_UPLOAD_BYTES} byte limit`);
  }
}

export { MAX_UPLOAD_BYTES };
