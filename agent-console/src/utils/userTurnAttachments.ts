import type { ChatAttachmentRef } from '../adapters/ports/IUploadPort';
import type { FileRef } from '../domain/types/userTurn';
import type { MessageFileItem, MessageImageItem } from '../domain/types';
import { attachmentPreviewSrc, isImageAttachment } from './attachmentPreview';

export function mapMessageAttachmentsToChatRefs(
  imageList?: MessageImageItem[],
  fileList?: MessageFileItem[],
): ChatAttachmentRef[] {
  const refs: ChatAttachmentRef[] = [];

  for (const image of imageList ?? []) {
    refs.push({
      uploadId: image.id,
      fileId: image.id,
      name: image.alt ?? image.id,
      mime: 'image/*',
      url: image.url,
      size: 0,
    });
  }

  for (const file of fileList ?? []) {
    refs.push({
      uploadId: file.id,
      fileId: file.id,
      name: file.name,
      mime: file.fileType ?? 'application/octet-stream',
      url: file.url ?? '',
      size: file.size ?? 0,
    });
  }

  return refs;
}

export function mapMessageAttachmentsToFileRefs(
  imageList?: MessageImageItem[],
  fileList?: MessageFileItem[],
): FileRef[] {
  return mapChatAttachmentRefsToFileRefs(mapMessageAttachmentsToChatRefs(imageList, fileList));
}

export function attachmentIdsEqual(
  left: ChatAttachmentRef[],
  right: ChatAttachmentRef[],
): boolean {
  const leftIds = left.map((item) => item.fileId ?? item.uploadId).sort();
  const rightIds = right.map((item) => item.fileId ?? item.uploadId).sort();
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

export function mapChatAttachmentRefToFileRef(ref: ChatAttachmentRef): FileRef {
  return {
    fileId: ref.fileId ?? ref.uploadId,
    name: ref.name,
    mimeType: ref.mime,
    size: ref.size,
    url: ref.url,
  };
}

export function mapChatAttachmentRefsToFileRefs(refs: ChatAttachmentRef[]): FileRef[] {
  return refs.map(mapChatAttachmentRefToFileRef);
}

export function mapRefsToMessageAttachments(refs: ChatAttachmentRef[]): {
  fileList: MessageFileItem[];
  imageList: MessageImageItem[];
} {
  const imageList: MessageImageItem[] = [];
  const fileList: MessageFileItem[] = [];

  for (const ref of refs) {
    const id = ref.fileId ?? ref.uploadId;
    if (isImageAttachment(ref)) {
      imageList.push({
        alt: ref.name,
        id,
        url: attachmentPreviewSrc(ref) ?? ref.url,
      });
      continue;
    }

    fileList.push({
      fileType: ref.mime,
      id,
      name: ref.name,
      size: ref.size,
      url: ref.url,
    });
  }

  return { fileList, imageList };
}

export function buildFilesOnlyPromptFromRefs(refs: ChatAttachmentRef[]): string {
  const names = refs.map((ref) => ref.name).filter(Boolean);
  return names.join('、') || '附件';
}
