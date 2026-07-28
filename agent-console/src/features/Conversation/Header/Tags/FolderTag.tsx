import { Tooltip } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import { showToast } from '../../../../services/ui/toast';
import { useLayoutStore, useTopicStore } from '../../../../stores';

const styles = createStaticStyles(({ css, cssVar }) => ({
  chip: css`
    cursor: pointer;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 200px;
    padding: 2px 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
    background: ${cssVar.colorFillTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
    transition:
      color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      color: ${cssVar.colorText};
      border-color: ${cssVar.colorBorder};
      background: ${cssVar.colorFillSecondary};
    }
  `,
}));

/** §C.15 FolderTag*/
export const FolderTag = memo(function FolderTag() {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const workingDirectory = useTopicStore(
    (s) => s.topics.find((t) => t.id === activeTopicId)?.workingDirectory,
  );
  const isCompactViewport = useLayoutStore((s) => s.isCompactViewport);

  if (isCompactViewport || !workingDirectory) return null;

  const displayName = workingDirectory.split('/').filter(Boolean).pop() ?? workingDirectory;

  return (
    <Tooltip title={`${workingDirectory} · 打开文件夹`}>
      <span
        className={styles.chip}
        onClick={() => showToast(`打开工作目录：${workingDirectory}`)}
      >
        {displayName}
      </span>
    </Tooltip>
  );
});
