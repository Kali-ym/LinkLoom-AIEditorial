import { Drawer, Flexbox, Tabs, Text } from '@lobehub/ui';
import { Input } from 'antd';
import { memo } from 'react';

import { ParamsSection } from '../WorkingSidebar/ParamsSection';
import { t } from '../../i18n';
import { useAgentStore } from '../../stores';
import { useAgentSettingStore } from '../../stores/agentSettingStore';

/** §C.55*/
export const AgentSettingDrawer = memo(function AgentSettingDrawer() {
  const open = useAgentSettingStore((s) => s.open);
  const tab = useAgentSettingStore((s) => s.tab);
  const closeAgentSetting = useAgentSettingStore((s) => s.closeAgentSetting);
  const setTab = useAgentSettingStore((s) => s.setTab);
  const agent = useAgentStore((s) => s.getActiveAgent());
  const plus = useAgentStore((s) => s.getActivePlusState());
  const updateAgentConfig = useAgentStore((s) => s.updateAgentConfig);

  return (
    <Drawer
      open={open}
      placement="right"
      title={t('agentSetting.title')}
      width={420}
      onClose={() => closeAgentSetting()}
    >
      <Flexbox gap={16}>
        <Tabs
          activeKey={tab}
          items={[
            { key: 'general', label: t('agentSetting.tabGeneral') },
            { key: 'params', label: t('agentSetting.tabParams') },
            { key: 'tools', label: t('agentSetting.tabTools') },
          ]}
          onChange={(key) => setTab(key as typeof tab)}
        />
        {tab === 'general' ? (
          <Flexbox gap={12}>
            <Flexbox gap={4}>
              <Text fontSize={12} type="secondary">
                {t('agentSetting.model')}
              </Text>
              <Text>
                {plus.model} · {plus.provider}
              </Text>
            </Flexbox>
            <Flexbox gap={4}>
              <Text fontSize={12} type="secondary">
                {t('agentSetting.systemPrompt')}
              </Text>
              <Input.TextArea
                autoSize={{ minRows: 8, maxRows: 20 }}
                defaultValue={plus.systemRole ?? agent.description ?? ''}
                onBlur={(e) => updateAgentConfig({ systemRole: e.target.value })}
              />
            </Flexbox>
          </Flexbox>
        ) : null}
        {tab === 'params' ? <ParamsSection /> : null}
        {tab === 'tools' ? (
          <Text type="secondary">工具与技能策略请在右侧工作面板中管理。</Text>
        ) : null}
      </Flexbox>
    </Drawer>
  );
});
