import type { ChatAttachmentRef, IUploadPort } from '../ports/IUploadPort';

export const mockUploadPort: IUploadPort = {
  async uploadFiles(_agentId, files) {
    await new Promise((r) => window.setTimeout(r, 120));
    return files.map((file, index) => {
      const uploadId = `mock-upload-${Date.now()}-${index}`;
      return {
        uploadId,
        fileId: uploadId,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        url: URL.createObjectURL(file),
      };
    }) satisfies ChatAttachmentRef[];
  },
};
