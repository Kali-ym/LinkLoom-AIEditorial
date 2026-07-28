import { AppError } from '../../domain/errors.js';
import { AgentUploadService } from './AgentUploadService.js';
import type {
  ChatFileItem,
  ChatImageItem,
  FileRef,
  ResolvedUserTurnFiles,
} from './userTurnPayload.js';
import { classifyUploadMime, uploadUrlFor } from './userTurnPayload.js';

export class UserTurnFileResolver {
  constructor(private readonly uploadService: AgentUploadService) {}

  async resolve(agentId: string, files: FileRef[]): Promise<ResolvedUserTurnFiles> {
    if (files.length === 0) {
      return { fileList: [], imageList: [] };
    }

    const imageList: ChatImageItem[] = [];
    const fileList: ChatFileItem[] = [];

    for (const ref of files) {
      const record = await this.uploadService.assertUploadOwnedByAgent(agentId, ref.fileId);
      const mime = record.mime;
      const url = uploadUrlFor(record.id);
      const name = ref.name?.trim() || record.name;
      const size = ref.size ?? record.size;

      if (classifyUploadMime(mime) === 'image') {
        imageList.push({
          alt: name,
          id: record.id,
          url,
        });
      } else {
        fileList.push({
          fileType: mime,
          id: record.id,
          name,
          size,
          url,
        });
      }
    }

    return { fileList, imageList };
  }
}
