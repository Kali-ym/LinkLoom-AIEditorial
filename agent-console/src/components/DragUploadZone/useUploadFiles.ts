import { useCallback } from 'react';

import { getAgentConsolePorts } from '../../adapters/registry';
import { useAgentModelMeta } from '../../hooks/useAgentModelMeta';
import { usePermission } from '../../hooks/usePermission';
import { showToast } from '../../services/ui/toast';
import { removeEmbedMediaFromEditor } from '../../features/ChatInput/editor/attachmentEditor';
import { enrichAttachmentsWithPreviews } from '../../utils/attachmentPreview';
import { useAgentStore, useInputStore } from '../../stores';
import { validateChatUploadFiles } from '../../utils/uploadValidation';
import { AgentConsoleApiError } from '../../adapters/api/http';

/** §C.49*/
export function useUploadFiles() {
  const { canUploadImage, canUploadVideo } = useAgentModelMeta();
  const { allowed: canUpload } = usePermission('create_content');

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      if (!canUpload || files.length === 0) return;

      const dt = new DataTransfer();
      for (const file of files) {
        dt.items.add(file);
      }

      const validation = validateChatUploadFiles(dt.files, { canUploadImage, canUploadVideo });
      if (!validation.ok) {
        showToast(validation.message ?? '无法上传该文件');
        return;
      }

      const filtered = Array.from(dt.files).filter((file) => {
        if (file.type.startsWith('image/')) return canUploadImage;
        if (file.type.startsWith('video/')) return canUploadVideo;
        return true;
      });

      if (filtered.length === 0) return;

      try {
        const agentId = useAgentStore.getState().activeAgentId;
        const refs = enrichAttachmentsWithPreviews(
          await getAgentConsolePorts().upload.uploadFiles(agentId, filtered),
          filtered,
        );
        useInputStore.getState().addChatUploadFiles(refs);
        removeEmbedMediaFromEditor(useInputStore.getState().mainEditor);
        useInputStore.getState().mainEditor?.focus();
        showToast(`已附加 ${refs.length} 个文件`);
      } catch (error) {
        const message =
          error instanceof AgentConsoleApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : '上传失败';
        showToast(message);
      }
    },
    [canUpload, canUploadImage, canUploadVideo],
  );

  return { handleUploadFiles };
}
