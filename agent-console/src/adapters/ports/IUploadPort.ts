export interface ChatAttachmentRef {
  uploadId: string;
  /** Same as uploadId when returned from agent-uploads API. */
  fileId?: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  /** Local blob URL for image thumb — API `url` may require auth headers. */
  previewUrl?: string;
}

export interface IUploadPort {
  uploadFiles(agentId: string, files: File[]): Promise<ChatAttachmentRef[]>;
}
