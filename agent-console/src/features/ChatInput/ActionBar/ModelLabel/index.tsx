import { Center, Flexbox, Tooltip } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { ChevronDown } from 'lucide-react';
import { memo, useCallback } from 'react';

import { useModelDisplayName } from '../../../../hooks/data';
import { usePermission } from '../../../../hooks/usePermission';
import { useTopicModel } from '../../../../hooks/useTopicModel';
import { useTopicStore } from '../../../../stores';
import { ModelSwitchPanel } from '../../ModelSwitchPanel';
import { useActionBarContext } from '../context';

const styles = createStaticStyles(({ css }) => ({
  chevron: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  name: css`
    overflow: hidden;
    max-width: 160px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  trigger: css`
    cursor: pointer;
    border-radius: 6px;

    :hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  triggerDisabled: css`
    cursor: not-allowed;
    opacity: 0.5;

    :hover {
      background: transparent;
    }
  `,
}));

/** §C.42*/
export const ModelLabel = memo(function ModelLabel() {
  const { dropdownPlacement } = useActionBarContext();
  const { allowed: canCreateContent, reason } = usePermission('create_content');
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const { model, provider, setTopicModel } = useTopicModel(activeTopicId);

  const displayName = useModelDisplayName(model, provider);

  const handleModelChange = useCallback(
    (params: { model: string; provider: string }) => {
      if (!canCreateContent) return;
      setTopicModel(params);
    },
    [canCreateContent, setTopicModel],
  );

  const trigger = (
    <Center
      horizontal
      className={cx(styles.trigger, !canCreateContent && styles.triggerDisabled)}
      height={28}
      paddingInline={6}
    >
      <Flexbox horizontal align="center" gap={2}>
        <span className={styles.name}>{displayName}</span>
        <ChevronDown className={styles.chevron} size={12} />
      </Flexbox>
    </Center>
  );

  if (!canCreateContent) {
    return <Tooltip title={reason}>{trigger}</Tooltip>;
  }

  return (
    <ModelSwitchPanel
      model={model}
      openOnHover={false}
      placement={dropdownPlacement ?? 'topLeft'}
      provider={provider}
      onModelChange={handleModelChange}
    >
      {trigger}
    </ModelSwitchPanel>
  );
});
