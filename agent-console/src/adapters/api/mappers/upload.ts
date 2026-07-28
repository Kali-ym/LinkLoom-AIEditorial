import type { ChatAttachmentRef } from '../../ports/IUploadPort';
import type { FileRef } from '../../../domain/types/userTurn';
import { resolveConsoleApiUrl } from '../../../domain/connection/consoleConnection';

export interface BackendUploadDto {
  uploadId: string;
  fileId?: string;
  name: string;
  mime: string;
  mimeType?: string;
  size: number;
  url: string;
}

function resolveApiUrl(path: string): string {
  return resolveConsoleApiUrl(path);
}

export function mapBackendUploadToRef(dto: BackendUploadDto): ChatAttachmentRef {
  const fileId = dto.fileId ?? dto.uploadId;
  return {
    uploadId: fileId,
    fileId,
    name: dto.name,
    mime: dto.mimeType ?? dto.mime,
    size: dto.size,
    url: resolveApiUrl(dto.url),
  };
}

export function mapChatAttachmentRefsToFileRefs(refs: ChatAttachmentRef[]): FileRef[] {
  return refs.map((ref) => ({
    fileId: ref.fileId ?? ref.uploadId,
    mimeType: ref.mime,
    name: ref.name,
    size: ref.size,
    url: ref.url,
  }));
}
