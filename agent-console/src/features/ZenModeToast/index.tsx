import { Flexbox, Hotkey } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useEffect, useState } from 'react';

import { HOTKEY_REGISTRY } from '../../constants/hotkeyStrings';
import { useLayoutStore } from '../../stores';
import { useHotkeySettingsStore } from '../../stores/hotkeySettingsStore';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    position: fixed;
    z-index: 50;
    inset-block-start: 16px;
    inset-inline-start: 50%;
    transform: translateX(-50%);
    animation: zen-toast-in 300ms ease;

    @keyframes zen-toast-in {
      from {
        transform: translate(-50%, -16px);
        opacity: 0;
      }
      to {
        transform: translate(-50%, 0);
        opacity: 1;
      }
    }
  `,
  toast: css`
    display: flex;
    align-items: center;
    padding-block: 8px;
    padding-inline: 24px;
    border-radius: 9999px;
    background: ${cssVar.colorText};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  text: css`
    font-size: 16px;
    font-weight: 500;
    color: ${cssVar.colorBgBase};
  `,
}));

const DEFAULT_ZEN_KEYS =
  HOTKEY_REGISTRY.find((item) => item.id === 'toggleZenMode')?.keys ?? 'mod+\\';

const ZenToast = memo(function ZenToast() {
  const [visible, setVisible] = useState(true);
  const zenKeys = useHotkeySettingsStore((s) => s.getKeys('toggleZenMode')) || DEFAULT_ZEN_KEYS;

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.container}>
      <div className={styles.toast}>
        <Flexbox horizontal align="center" className={styles.text} gap={8}>
          专注模式
          <Hotkey inverseTheme keys={zenKeys} />
        </Flexbox>
      </div>
    </div>
  );
});

/** §C.58 ZenModeToast*/
export const ZenModeToast = memo(function ZenModeToast() {
  const zenMode = useLayoutStore((s) => s.zenMode);
  return zenMode ? <ZenToast /> : null;
});
