import { Flexbox, Hotkey, HotkeyInput, Segmented, Text } from '@lobehub/ui';
import { memo, useMemo, useState } from 'react';

import {
  HOTKEY_REGISTRY,
  HotkeyGroupEnum,
  type HotkeyGroupId,
  getHotkeyRegistryItem,
} from '../../constants/hotkeyStrings';
import { t } from '../../i18n';
import { useHotkeySettingsStore } from '../../stores/hotkeySettingsStore';

const GROUP_LABELS: Record<HotkeyGroupId, string> = {
  [HotkeyGroupEnum.Essential]: t('hotkeys.groupEssential'),
  [HotkeyGroupEnum.Conversation]: t('hotkeys.groupConversation'),
};

export const HotkeySettingsList = memo(function HotkeySettingsList() {
  const overrides = useHotkeySettingsStore((s) => s.overrides);
  const [group, setGroup] = useState<HotkeyGroupId>(HotkeyGroupEnum.Essential);

  const items = useMemo(
    () => HOTKEY_REGISTRY.filter((item) => item.group === group),
    [group, overrides],
  );

  return (
    <Flexbox gap={16}>
      <Segmented
        options={[
          { label: GROUP_LABELS[HotkeyGroupEnum.Essential], value: HotkeyGroupEnum.Essential },
          {
            label: GROUP_LABELS[HotkeyGroupEnum.Conversation],
            value: HotkeyGroupEnum.Conversation,
          },
        ]}
        value={group}
        onChange={(v) => setGroup(v as HotkeyGroupId)}
      />
      <Flexbox gap={12}>
        {items.map((item) => (
          <HotkeySettingsRow key={item.id} hotkeyId={item.id} title={item.title} />
        ))}
      </Flexbox>
    </Flexbox>
  );
});

const HotkeySettingsRow = memo(function HotkeySettingsRow({
  hotkeyId,
  title,
}: {
  hotkeyId: string;
  title: string;
}) {
  const keys = useHotkeySettingsStore((s) => s.getKeys(hotkeyId));
  const setKeys = useHotkeySettingsStore((s) => s.setKeys);
  const resetKeys = useHotkeySettingsStore((s) => s.resetKeys);
  const overrides = useHotkeySettingsStore((s) => s.overrides);
  const item = getHotkeyRegistryItem(hotkeyId);

  const hotkeyConflicts = useMemo(() => {
    const current = keys;
    return Object.entries(overrides)
      .filter(([id, value]) => id !== hotkeyId && value === current)
      .map(([, value]) => value);
  }, [hotkeyId, keys, overrides]);

  if (!item) return null;

  if (item.nonEditable) {
    return (
      <Flexbox horizontal align="center" justify="space-between" gap={12}>
        <Text style={{ flex: 1 }}>{title}</Text>
        <Hotkey inverseTheme keys={keys} />
      </Flexbox>
    );
  }

  return (
    <Flexbox horizontal align="center" justify="space-between" gap={12}>
      <Text style={{ flex: 1, minWidth: 0 }}>{title}</Text>
      <HotkeyInput
        allowClear
        hotkeyConflicts={hotkeyConflicts}
        placeholder="按下快捷键"
        resetValue={item.keys}
        style={{ width: 180 }}
        texts={{ clear: '清除' }}
        value={keys}
        onChange={(value) => setKeys(hotkeyId, value)}
        onClear={() => resetKeys(hotkeyId)}
      />
    </Flexbox>
  );
});
