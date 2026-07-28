import { DropdownMenu, type DropdownMenuProps, Icon, Tooltip } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ChevronDown, Code2, Terminal } from 'lucide-react';
import { memo, useMemo } from 'react';

import { showToast } from '../../services/ui/toast';

const styles = createStaticStyles(({ css }) => ({
  leftButton: css`
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-inline: 8px;
    color: ${cssVar.colorTextSecondary};
    transition: all 0.2s;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  rightButton: css`
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-inline: 4px;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    color: ${cssVar.colorTextSecondary};
    transition: all 0.2s;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  root: css`
    overflow: hidden;
    display: inline-flex;
    align-items: stretch;
    height: 24px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 6px;
  `,
}));

const MOCK_APPS = [
  { id: 'cursor', label: 'Cursor', icon: Code2 },
  { id: 'vscode', label: 'VS Code', icon: Terminal },
] as const;

export interface OpenInAppButtonProps {
  workingDirectory: string;
  className?: string;
}

/** §C.15 OpenInAppButton*/
export const OpenInAppButton = memo(function OpenInAppButton({
  workingDirectory,
  className,
}: OpenInAppButtonProps) {
  const defaultApp = MOCK_APPS[0];

  const dropdownItems = useMemo<DropdownMenuProps['items']>(
    () =>
      MOCK_APPS.map((app) => ({
        icon: <Icon icon={app.icon} size={14} />,
        key: app.id,
        label: app.label,
        onClick: () => {
          showToast(`在 ${app.label} 中打开：${workingDirectory}`);
        },
      })),
    [workingDirectory],
  );

  if (!workingDirectory) return null;

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <Tooltip title={`在 ${defaultApp.label} 中打开`}>
        <div
          aria-label={`在 ${defaultApp.label} 中打开`}
          className={styles.leftButton}
          role="button"
          tabIndex={0}
          onClick={() => {
            showToast(`在 ${defaultApp.label} 中打开：${workingDirectory}`);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              showToast(`在 ${defaultApp.label} 中打开：${workingDirectory}`);
            }
          }}
        >
          <Icon icon={defaultApp.icon} size={16} />
        </div>
      </Tooltip>
      <DropdownMenu items={dropdownItems} placement="bottomRight">
        <div aria-label="选择应用" className={styles.rightButton} role="button" tabIndex={0}>
          <Icon icon={ChevronDown} size={14} />
        </div>
      </DropdownMenu>
    </div>
  );
});
