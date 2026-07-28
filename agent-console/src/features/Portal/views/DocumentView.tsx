import { Alert, Button, Flexbox, Markdown, ScrollArea, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { readActiveAgentIdFallback } from '../../../hooks/data/useActiveAgentId';
import {
  documentFrontmatterForEdit,
  parseMarkdownFrontmatter,
} from '../../../domain/utils/markdownFrontmatter';
import type { DocumentFrontmatter } from '../../../domain/utils/markdownFrontmatter';
import { resolveDocumentContent } from '../../../hooks/data/usePortal';
import { selectMessageById } from '../../../selectors/storeSelectors';
import type { PortalViewPayload } from '../../../domain/types/portalView';
import { EditorCanvas } from '../../EditorModal/EditorCanvas';
import { useChatStore, usePortalStore, useTopicStore, useWorkspaceStore } from '../../../stores';
import { portalStrings } from '../portalStrings';
import { replacePortalView } from '../portalActions';
import {
  formatWorkspaceDocumentSaveLabel,
  useWorkspaceDocumentEditor,
} from '../hooks/useWorkspaceDocumentEditor';
import { portalViewStyles } from '../portalViewStyles';
import { DocumentFrontmatterCard } from './DocumentFrontmatterCard';
import { DocumentTodoProgress } from './DocumentTodoProgress';

function resolveFallbackTitle(payload: PortalViewPayload, filePath: string, docTitle: string): string {
  if (payload.title?.trim()) return payload.title.trim();
  if (filePath) {
    const segments = filePath.split('/');
    return segments[segments.length - 1] ?? filePath;
  }
  return docTitle;
}

/** §C.21 Document*/
export const DocumentView = memo(function DocumentView({ payload }: { payload: PortalViewPayload }) {
  const documentDefault = useWorkspaceStore((s) => s.portalContent.documentDefault);
  const doc = resolveDocumentContent(payload, documentDefault);
  const error = payload.error;

  const filePath = typeof payload.path === 'string' ? payload.path.trim() : '';
  const agentId =
    (typeof payload.agentId === 'string' && payload.agentId.trim()) ||
    readActiveAgentIdFallback() ||
    '';

  const fallbackMarkdown = useMemo(
    () => [`# ${doc.title}`, ...doc.paragraphs].join('\n\n'),
    [doc.title, doc.paragraphs],
  );

  const sourceMarkdown = payload.content ?? fallbackMarkdown;
  const parsedDocument = useMemo(
    () => parseMarkdownFrontmatter(sourceMarkdown),
    [sourceMarkdown],
  );

  const fallbackTitle = resolveFallbackTitle(payload, filePath, doc.title);
  const initialFrontmatter = useMemo(
    () => documentFrontmatterForEdit(parsedDocument.frontmatter, fallbackTitle),
    [fallbackTitle, parsedDocument.frontmatter],
  );

  const fileUpdatedAt =
    typeof payload.updatedAt === 'number' ? payload.updatedAt : undefined;

  const editorKey = filePath ? `${agentId}:${filePath}` : 'document-readonly';

  const [frontmatter, setFrontmatter] = useState<DocumentFrontmatter>(initialFrontmatter);
  const frontmatterRef = useRef(initialFrontmatter);

  useEffect(() => {
    setFrontmatter(initialFrontmatter);
    frontmatterRef.current = initialFrontmatter;
  }, [initialFrontmatter, editorKey]);

  const handleFrontmatterChange = useCallback((next: DocumentFrontmatter) => {
    setFrontmatter(next);
    frontmatterRef.current = next;
  }, []);

  const { editor, editable, saveStatus, handleTextChange, scheduleSave } = useWorkspaceDocumentEditor({
    path: filePath,
    agentId,
    enabled: Boolean(filePath),
    updatedAt: fileUpdatedAt,
    getFrontmatter: () => frontmatterRef.current,
  });

  const handleReloadFromDisk = useCallback(() => {
    replacePortalView('Document', {
      path: filePath,
      title: payload.title,
      agentId,
    });
  }, [agentId, filePath, payload.title]);

  const handleFrontmatterFieldChange = useCallback(
    (next: DocumentFrontmatter) => {
      handleFrontmatterChange(next);
      scheduleSave();
    },
    [handleFrontmatterChange, scheduleSave],
  );

  if (!filePath && !payload.documentId && !payload.id) return null;

  return (
    <Flexbox className={portalViewStyles.bodyRoot} flex={1} style={{ minHeight: 0 }}>
      {error ? (
        <Alert message={String(error)} style={{ margin: 12 }} type="error" />
      ) : null}

      {saveStatus === 'conflict' ? (
        <Alert
          action={
            <Button size="small" type="link" onClick={handleReloadFromDisk}>
              重新加载
            </Button>
          }
          message="沙箱中的文件已被更新，本地编辑尚未保存。"
          style={{ margin: '0 12px' }}
          type="warning"
        />
      ) : null}

      <DocumentFrontmatterCard
        editable={editable}
        frontmatter={frontmatter}
        onChange={editable ? handleFrontmatterFieldChange : undefined}
      />

      <DocumentTodoProgress />

      <Flexbox className={portalViewStyles.scrollBody} flex={1}>
        <EditorCanvas
          defaultValue={parsedDocument.body}
          editor={editor}
          editorKey={editorKey}
          onTextChange={editable ? handleTextChange : undefined}
        />
      </Flexbox>

      <Text
        fontSize={11}
        style={{ flexShrink: 0, padding: '8px 16px', color: cssVar.colorTextTertiary }}
        type="secondary"
      >
        {formatWorkspaceDocumentSaveLabel(saveStatus, editable)}
      </Text>
    </Flexbox>
  );
});

/** §C.21 MessageDetail*/
export const MessageDetailView = memo(function MessageDetailView({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  const topicId = useTopicStore((s) => s.activeTopicId);
  const message = useChatStore(selectMessageById(topicId, payload.messageId ?? ''));
  const clear = usePortalStore((s) => s.clearPortalStack);

  useEffect(() => {
    if (payload.messageId && !message) {
      clear();
    }
  }, [clear, message, payload.messageId]);

  const content =
    message?.content ?? payload.content ?? portalStrings.messageDetail.empty;

  return (
    <Flexbox flex={1} style={{ minHeight: 0, paddingBlock: '0 12px', paddingInline: 8 }}>
      <ScrollArea scrollFade style={{ height: '100%' }}>
        <Markdown enableHtmlPreview style={{ paddingBlockEnd: 40 }} variant="chat">
          {content}
        </Markdown>
      </ScrollArea>
    </Flexbox>
  );
});
