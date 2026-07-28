import type { IEditor } from '@lobehub/editor';
import { useEditor } from '@lobehub/editor/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { readActiveAgentIdFallback } from '../../../hooks/data/useActiveAgentId';
import { isDocumentSaveConflict } from '../../../services/workspace/documentSaveErrors';
import type { DocumentFrontmatter } from '../../../domain/utils/markdownFrontmatter';
import { serializeMarkdownFrontmatter } from '../../../domain/utils/markdownFrontmatter';
import { readEditorMarkdown } from '../../ChatInput/editor/editorText';
import { useRegisterFilesHotkeys } from '../../../hooks/useHotkeys';
import { writeWorkspaceFileContent } from '../../../services/workspace/documentTreeOps';
import { usePortalStore } from '../../../stores';
import type { WorkspaceDocumentSaveStatus } from './workspaceDocumentSaveLabel';

const AUTOSAVE_MS = 800;

export type { WorkspaceDocumentSaveStatus } from './workspaceDocumentSaveLabel';
export { formatWorkspaceDocumentSaveLabel } from './workspaceDocumentSaveLabel';

export function useWorkspaceDocumentEditor(payload: {
  path?: string;
  agentId?: string;
  enabled: boolean;
  updatedAt?: number;
  getFrontmatter?: () => DocumentFrontmatter;
}) {
  const editor = useEditor();
  const [saveStatus, setSaveStatus] = useState<WorkspaceDocumentSaveStatus>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const baseUpdatedAtRef = useRef<number | undefined>(payload.updatedAt);

  const filePath = typeof payload.path === 'string' ? payload.path.trim() : '';
  const agentId =
    (typeof payload.agentId === 'string' && payload.agentId.trim()) ||
    readActiveAgentIdFallback() ||
    '';
  const editable = payload.enabled && Boolean(filePath && agentId);

  const getFrontmatter = payload.getFrontmatter;

  const saveNow = useCallback(async () => {
    if (!editable || !editor || savingRef.current) return;
    const body = readEditorMarkdown(editor);
    const content = getFrontmatter
      ? serializeMarkdownFrontmatter(getFrontmatter(), body)
      : body;
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      const result = await writeWorkspaceFileContent(agentId, filePath, content, {
        expectedUpdatedAt: baseUpdatedAtRef.current,
      });
      baseUpdatedAtRef.current = result.updatedAt;
      dirtyRef.current = false;
      setSaveStatus('saved');
      const portal = usePortalStore.getState();
      const current = portal.currentView();
      if (current?.type === 'Document' && current.payload?.path === filePath) {
        const patch: Record<string, unknown> = { content, updatedAt: result.updatedAt };
        const title = getFrontmatter?.()?.title?.trim();
        if (title) patch.title = title;
        portal.patchCurrentPayload(patch);
      }
    } catch (error) {
      if (isDocumentSaveConflict(error)) {
        setSaveStatus('conflict');
      } else {
        setSaveStatus('error');
      }
    } finally {
      savingRef.current = false;
    }
  }, [agentId, editable, editor, filePath, getFrontmatter]);

  const scheduleSave = useCallback(() => {
    if (!editable) return;
    dirtyRef.current = true;
    if (saveStatus === 'saved' || saveStatus === 'conflict') {
      setSaveStatus('idle');
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void saveNow();
    }, AUTOSAVE_MS);
  }, [editable, saveNow, saveStatus]);

  const handleTextChange = useCallback(
    (_editor: IEditor) => {
      scheduleSave();
    },
    [scheduleSave],
  );

  useRegisterFilesHotkeys(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void saveNow();
  });

  useEffect(() => {
    baseUpdatedAtRef.current = payload.updatedAt;
    dirtyRef.current = false;
    setSaveStatus('idle');
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [filePath, agentId, payload.updatedAt]);

  return {
    editor,
    editable,
    saveStatus,
    handleTextChange,
    scheduleSave,
    saveNow,
  };
}
