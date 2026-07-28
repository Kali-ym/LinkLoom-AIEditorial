import type { ChatAttachmentRef } from '../adapters/ports/IUploadPort';

const IMAGE_NAME_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

export function isImageAttachment(attachment: Pick<ChatAttachmentRef, 'mime' | 'name'>): boolean {
  if (attachment.mime.startsWith('image/')) return true;
  return IMAGE_NAME_RE.test(attachment.name);
}

export function attachmentPreviewSrc(attachment: ChatAttachmentRef): string | undefined {
  if (attachment.previewUrl) return attachment.previewUrl;
  if (isImageAttachment(attachment) && attachment.url) return attachment.url;
  return undefined;
}

export function enrichAttachmentsWithPreviews(
  refs: ChatAttachmentRef[],
  files: File[],
): ChatAttachmentRef[] {
  return refs.map((ref, index) => {
    const file = files[index];
    if (!file?.type.startsWith('image/')) return ref;
    return { ...ref, previewUrl: URL.createObjectURL(file) };
  });
}

export function revokeAttachmentPreview(attachment: ChatAttachmentRef): void {
  if (attachment.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}

export function revokeAttachmentPreviews(attachments: ChatAttachmentRef[]): void {
  for (const attachment of attachments) {
    revokeAttachmentPreview(attachment);
  }
}
