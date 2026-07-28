import { Flexbox } from '@lobehub/ui';
import { memo, useMemo, useRef } from 'react';

import { useAgentModelMeta } from '../../hooks/useAgentModelMeta';
import { showToast } from '../../services/ui/toast';
import { useConfigStore } from '../../stores';
import { validateChatUploadFiles } from '../../utils/uploadValidation';
import type { ChatInputActionKey } from './ActionBar/config';
import { actionMap } from './ActionBar/config';
import { ActionBarProvider } from './ActionBar/context';

/** §C.38 / §C.57 左 ActionBar*/
export const InputActionBar = memo(function InputActionBar({
  leftActions,
  onFilesSelected,
}: {
  leftActions: ChatInputActionKey[];
  onFilesSelected?: (files: FileList) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canUploadImage, canUploadVideo } = useAgentModelMeta();
  const enableInputMarkdown = useConfigStore((s) => s.enableInputMarkdown);

  const filteredActions = useMemo(
    () =>
      leftActions.filter((key) => (enableInputMarkdown !== false ? true : key !== 'typo')),
    [enableInputMarkdown, leftActions],
  );

  const items = useMemo(
    () =>
      filteredActions
        .filter((key): key is keyof typeof actionMap => key in actionMap)
        .map((key) => {
          const Component = actionMap[key];
          return <Component key={key} />;
        }),
    [filteredActions],
  );

  return (
    <ActionBarProvider
      value={{
        dropdownPlacement: 'topLeft',
        onUploadClick: () => fileInputRef.current?.click(),
      }}
    >
      <Flexbox horizontal align="center" gap={6} paddingInline={4}>
        {items}
      </Flexbox>
      <input
        ref={fileInputRef}
        type="file"
        id="fileUploadInput"
        multiple
        hidden
        accept="image/*,video/*,.pdf,.md,.txt,.json,.ts,.tsx,.js,.jsx"
        onChange={(e) => {
          const files = e.target.files;
          if (!files?.length) return;
          const validation = validateChatUploadFiles(files, { canUploadImage, canUploadVideo });
          if (!validation.ok) {
            showToast(validation.message ?? '无法上传该文件');
            e.target.value = '';
            return;
          }
          onFilesSelected?.(files);
          e.target.value = '';
        }}
      />
    </ActionBarProvider>
  );
});
