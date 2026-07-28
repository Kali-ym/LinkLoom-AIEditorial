import { Avatar, Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { InterventionPanel, InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';
import { resolvePluginDisplay } from './pluginDisplayRegistry';

export const InstallPluginIntervention = memo(function InstallPluginIntervention({
  args,
}: BuiltinInterventionProps) {
  const identifier = typeof args.identifier === 'string' ? args.identifier : '—';
  const source = typeof args.source === 'string' ? args.source : 'market';
  const plugin = resolvePluginDisplay(identifier, source);

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="批准后将安装并启用此插件，请确认来源可信。"
        title="安装插件"
      />
      <InterventionPanel>
        <Flexbox horizontal align="center" gap={14}>
          <Avatar avatar={plugin.icon} size={44} style={{ borderRadius: 12, flexShrink: 0 }} />
          <Flexbox flex={1} gap={6} style={{ minWidth: 0 }}>
            <Flexbox horizontal align="center" gap={8} wrap="wrap">
              <span className={interventionStyles.leadTitle}>{plugin.label}</span>
              <span className={interventionStyles.metaChip}>{plugin.type}</span>
            </Flexbox>
            <p className={interventionStyles.leadDesc}>{plugin.subtitle}</p>
            <div className={interventionStyles.metaRow}>
              <span className={interventionStyles.metaChip}>{identifier}</span>
            </div>
          </Flexbox>
        </Flexbox>
      </InterventionPanel>
    </Flexbox>
  );
});
