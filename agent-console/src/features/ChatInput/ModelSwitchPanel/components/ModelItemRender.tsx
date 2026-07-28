import { Flexbox, Tag } from '@lobehub/ui';
import { ModelIcon } from '@lobehub/icons';
import { memo } from 'react';

import type { AiModelAbilities } from '../../../../domain/types/aiModel';

interface ModelItemRenderProps extends AiModelAbilities {
  displayName?: string;
  id: string;
  showInfoTag?: boolean;
}

/** §C.42*/
export const ModelItemRender = memo(function ModelItemRender({
  displayName,
  id,
  imageOutput,
  reasoning,
  vision,
}: ModelItemRenderProps) {
  return (
    <Flexbox horizontal align="center" flex={1} gap={8} style={{ minWidth: 0 }}>
      <ModelIcon model={id} size={20} />
      <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName || id}
        </div>
        <Flexbox horizontal gap={4} wrap="wrap">
          {vision ? <Tag size="small">Vision</Tag> : null}
          {imageOutput ? <Tag size="small">Image</Tag> : null}
          {reasoning ? <Tag size="small">Reasoning</Tag> : null}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});
