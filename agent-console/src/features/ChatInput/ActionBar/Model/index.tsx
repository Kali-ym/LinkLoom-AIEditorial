import { ModelIcon } from '@lobehub/icons';
import { Center, Tooltip } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo, useCallback } from 'react';

import { usePermission } from '../../../../hooks/usePermission';
import { useTopicModel } from '../../../../hooks/useTopicModel';
import { useTopicStore } from '../../../../stores';
import { ModelSwitchPanel } from '../../ModelSwitchPanel';
import { useActionBarContext } from '../context';

const styles = createStaticStyles(({ css, cssVar }) => ({
  icon: css`
    transition: scale 400ms cubic-bezier(0.215, 0.61, 0.355, 1);
  `,
  modelDisabled: css`
    cursor: not-allowed;
    opacity: 0.5;

    :hover {
      background: transparent;
    }

    :active div {
      scale: 1;
    }
  `,
  model: css`
    cursor: pointer;
    border-radius: 24px;

    :hover {
      background: ${cssVar.colorFillSecondary};
    }

    :active div {
      scale: 0.8;
    }
  `,
}));

const BLOCK_SIZE = 32;
const ICON_SIZE = 20;

/** §C.38 model*/
export const Model = memo(function Model() {
  const { dropdownPlacement } = useActionBarContext();
  const { allowed: canCreateContent, reason } = usePermission('create_content');
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const { model, provider, setTopicModel } = useTopicModel(activeTopicId);

  const handleModelChange = useCallback(
    (params: { model: string; provider: string }) => {
      if (!canCreateContent) return;
      setTopicModel(params);
    },
    [canCreateContent, setTopicModel],
  );

  const trigger = (
    <Center
      className={cx(styles.model, !canCreateContent && styles.modelDisabled)}
      height={BLOCK_SIZE}
      width={BLOCK_SIZE}
    >
      <div className={styles.icon}>
        <ModelIcon model={model} size={ICON_SIZE} />
      </div>
    </Center>
  );

  if (!canCreateContent) {
    return <Tooltip title={reason}>{trigger}</Tooltip>;
  }

  return (
    <ModelSwitchPanel
      model={model}
      placement={dropdownPlacement ?? 'topLeft'}
      provider={provider}
      onModelChange={handleModelChange}
    >
      {trigger}
    </ModelSwitchPanel>
  );
});
