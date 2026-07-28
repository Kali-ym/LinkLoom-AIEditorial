import { Popover } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type PropsWithChildren } from 'react';
import { memo } from 'react';

const styles = createStaticStyles(({ cssVar, css }) => ({
  trigger: css`
    &[data-popup-open] {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}));

interface SwitchPanelProps extends PropsWithChildren {
  content: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** §C.1 SwitchPanel — Popover 240px bottomLeft click */
export const SwitchPanel = memo(function SwitchPanel({
  children,
  content,
  open,
  onOpenChange,
}: SwitchPanelProps) {
  return (
    <Popover
      classNames={{ trigger: styles.trigger }}
      content={content}
      nativeButton={false}
      open={open}
      onOpenChange={onOpenChange}
      placement="bottomLeft"
      trigger="click"
      styles={{
        content: {
          padding: 0,
          width: 240,
        },
      }}
    >
      {children}
    </Popover>
  );
});
