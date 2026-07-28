import { Button, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import { useTaskDetailPageStore } from '../../stores/taskDetailPageStore';

/** §C.54*/
export const TaskArtifacts = memo(function TaskArtifacts() {
  const artifacts = useTaskDetailPageStore((s) => s.detail?.artifacts ?? []);
  const openArtifactPreview = useTaskDetailPageStore((s) => s.openArtifactPreview);

  if (artifacts.length === 0) {
    return (
      <Text type="secondary" fontSize={12}>
        暂无产物
      </Text>
    );
  }

  return (
    <Flexbox gap={8}>
      {artifacts.map((artifact) => (
        <Button key={artifact.id} type="text" onClick={() => openArtifactPreview(artifact)}>
          {artifact.name} <Text type="secondary">({artifact.type})</Text>
        </Button>
      ))}
    </Flexbox>
  );
});
