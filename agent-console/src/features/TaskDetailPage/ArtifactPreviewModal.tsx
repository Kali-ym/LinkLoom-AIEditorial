import { Modal, Text } from '@lobehub/ui';
import { memo } from 'react';

import { useTaskDetailPageStore } from '../../stores/taskDetailPageStore';
import { taskDetailPageStrings } from './taskDetailPageStrings';

/** §C.54*/
export const ArtifactPreviewModal = memo(function ArtifactPreviewModal() {
  const artifact = useTaskDetailPageStore((s) => s.previewArtifact);
  const close = useTaskDetailPageStore((s) => s.closeArtifactPreview);

  return (
    <Modal footer={null} open={Boolean(artifact)} title={artifact?.name} onCancel={close}>
      <Text type="secondary">
        {taskDetailPageStrings.artifactPreviewHint} ({artifact?.type})
      </Text>
      <pre
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 8,
          background: 'var(--ant-color-fill-quaternary)',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
        }}
      >
        {`# ${artifact?.name ?? 'artifact'}\n\n（mock 预览内容）`}
      </pre>
    </Modal>
  );
});
