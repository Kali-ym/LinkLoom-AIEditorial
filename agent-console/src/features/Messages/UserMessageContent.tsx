import { Flexbox, Markdown } from '@lobehub/ui';
import { memo } from 'react';

import type {
  MessageFileItem,
  MessageImageItem,
  MessageVideoItem,
  PageSelection,
} from '../../domain/types';
import { resolveUserMessageText } from '../../utils/userMessageContent';
import {
  editorDataNeedsRichTextRenderer,
  ensureMarkdownLinks,
  extractPlainTextFromEditorData,
} from './messageMarkdown';
import {
  stripAttachedFilesIndexFromMarkdown,
  stripUploadMediaFromMarkdown,
} from '../../utils/uploadMessageContent';
import { CollapsibleContent } from './User/CollapsibleContent';
import { FileListViewer } from './User/FileListViewer';
import { ImageFileListViewer } from './User/ImageFileListViewer';
import { PageSelections } from './User/PageSelections';
import { RichTextMessage } from './User/RichTextMessage';
import { useUserMessageMarkdown } from './User/useConversationMarkdown';
import { VideoFileListViewer } from './User/VideoFileListViewer';
import type { UserMessageViewModel } from './StaticUserMessage';

function buildAttachmentFallbackText(
  imageList?: MessageImageItem[],
  fileList?: MessageFileItem[],
): string {
  const names = [
    ...(imageList ?? []).map((item) => item.alt).filter(Boolean),
    ...(fileList ?? []).map((item) => item.name).filter(Boolean),
  ];
  return names.join('、');
}

/** §C.10*/
export const UserMessageContent = memo(function UserMessageContent({
  message,
  pageSelections,
  imageList,
  videoList,
  fileList,
}: {
  message: UserMessageViewModel;
  pageSelections?: PageSelection[];
  imageList?: MessageImageItem[];
  videoList?: MessageVideoItem[];
  fileList?: MessageFileItem[];
}) {
  const markdownProps = useUserMessageMarkdown(message.id);
  const displayContent = resolveUserMessageText(message);
  const hasEditorData =
    message.editorData &&
    typeof message.editorData === 'object' &&
    Object.keys(message.editorData as Record<string, unknown>).length > 0;
  const useRichTextRenderer = hasEditorData && editorDataNeedsRichTextRenderer(message.editorData);
  const hasImageAttachments = (imageList?.length ?? 0) > 0;
  const hasFileAttachments = (fileList?.length ?? 0) > 0;
  let displayMarkdown = displayContent;
  if (!displayMarkdown && hasEditorData && !useRichTextRenderer) {
    displayMarkdown = extractPlainTextFromEditorData(message.editorData);
  }
  if (hasImageAttachments) {
    displayMarkdown = stripUploadMediaFromMarkdown(displayMarkdown);
  }
  if (hasFileAttachments) {
    displayMarkdown = stripAttachedFilesIndexFromMarkdown(displayMarkdown);
  }
  const hasAttachments =
    hasImageAttachments ||
    (videoList?.length ?? 0) > 0 ||
    (fileList?.length ?? 0) > 0;
  const attachmentFallback = buildAttachmentFallbackText(imageList, fileList);
  const isAttachmentOnlyText =
    hasAttachments &&
    Boolean(displayMarkdown) &&
    (displayMarkdown.trim() === attachmentFallback || displayMarkdown.trim() === '附件');
  const showTextBody = Boolean(displayMarkdown) && !isAttachmentOnlyText;

  const textBody = useRichTextRenderer ? (
    <RichTextMessage editorState={message.editorData} />
  ) : showTextBody && displayMarkdown ? (
    <Markdown {...markdownProps} variant="chat">
      {ensureMarkdownLinks(displayMarkdown)}
    </Markdown>
  ) : null;

  return (
    <Flexbox align="flex-start" gap={8} style={{ maxWidth: '100%', width: 'fit-content' }}>
      <PageSelections selections={pageSelections ?? []} />
      {textBody ? <CollapsibleContent>{textBody}</CollapsibleContent> : null}
      <ImageFileListViewer images={imageList ?? []} />
      <VideoFileListViewer videos={videoList ?? []} />
      <FileListViewer files={fileList ?? []} />
    </Flexbox>
  );
});
