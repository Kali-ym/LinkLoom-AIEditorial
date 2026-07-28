import { Modal } from '@lobehub/ui';
import { memo } from 'react';

import { HotkeySettingsList } from '../HotkeySettings/HotkeySettingsList';
import { useHotkeyHelperStore } from '../../stores/hotkeyHelperStore';

/** §C.55*/
export const HotkeyHelperPanel = memo(function HotkeyHelperPanel() {
  const open = useHotkeyHelperStore((s) => s.open);
  const setOpen = useHotkeyHelperStore((s) => s.setOpen);

  return (
    <Modal
      footer={null}
      open={open}
      title="快捷键"
      width={520}
      onCancel={() => setOpen(false)}
    >
      <HotkeySettingsList />
    </Modal>
  );
});
