import { useEditor } from '@lobehub/editor/react';
import { Modal } from '@lobehub/ui';
import { memo, useState } from 'react';

import type { ChatAttachmentRef } from '../../adapters/ports/IUploadPort';
import { EditorCanvas } from './EditorCanvas';
import { EditMessageAttachments } from './EditMessageAttachments';

interface EditorModalProps {
  attachments?: ChatAttachmentRef[];
  editorData?: unknown;
  okText?: string;
  onAttachmentsChange?: (attachments: ChatAttachmentRef[]) => void;
  onCancel?: () => void;
  onConfirm?: (value: string, editorData?: unknown) => Promise<void>;
  open?: boolean;
  value?: string;
}

/** §C.10*/
export const EditorModal = memo(function EditorModal({
  value,
  editorData: initialEditorData,
  attachments,
  onAttachmentsChange,
  onConfirm,
  okText = '确定',
  open,
  onCancel,
}: EditorModalProps) {
  const [confirmLoading, setConfirmLoading] = useState(false);
  const editor = useEditor();

  const handleRemoveAttachment = (uploadId: string) => {
    if (!attachments || !onAttachmentsChange) return;
    onAttachmentsChange(attachments.filter((item) => item.uploadId !== uploadId));
  };

  return (
    <Modal
      destroyOnHidden
      cancelText="取消"
      closable={false}
      confirmLoading={confirmLoading}
      okText={okText}
      open={open}
      title={null}
      width="min(90vw, 920px)"
      styles={{ body: { overflow: 'hidden', padding: 0 } }}
      onCancel={onCancel}
      onOk={async () => {
        setConfirmLoading(true);
        try {
          const finalValue = (editor?.getDocument('markdown') as unknown as string) || '';
          const nextEditorData = editor?.getDocument('json');
          await onConfirm?.(finalValue, nextEditorData);
        } finally {
          setConfirmLoading(false);
        }
      }}
    >
      <EditMessageAttachments attachments={attachments ?? []} onRemove={handleRemoveAttachment} />
      <EditorCanvas defaultValue={value} editor={editor} editorData={initialEditorData} />
    </Modal>
  );
});
