import { Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import { CommandSnippet } from '../../CommandSnippet';
import { InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';

function formatTimeout(ms?: number) {
  if (!ms) return null;
  const seconds = ms / 1000;
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)} 分钟`;
  if (seconds >= 1) return `${seconds.toFixed(1)} 秒`;
  return `${ms} 毫秒`;
}

export const RunCommandIntervention = memo(function RunCommandIntervention({
  args,
}: BuiltinInterventionProps) {
  const description = typeof args.description === 'string' ? args.description : undefined;
  const command = typeof args.command === 'string' ? args.command : undefined;
  const timeout = typeof args.timeout === 'number' ? args.timeout : undefined;
  const timeoutLabel = formatTimeout(timeout);

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description={description ?? '以下命令将在你的工作区终端中执行。'}
        title="Shell 命令"
      >
        {timeoutLabel ? (
          <div className={interventionStyles.metaRow}>
            <span className={interventionStyles.metaChip}>超时 {timeoutLabel}</span>
          </div>
        ) : null}
      </InterventionSection>
      {command ? <CommandSnippet language="sh" text={command} /> : <Text type="secondary">未提供命令内容</Text>}
    </Flexbox>
  );
});
