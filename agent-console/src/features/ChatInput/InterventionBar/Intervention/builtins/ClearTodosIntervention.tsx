import { Flexbox } from '@lobehub/ui';
import { Trash2 } from 'lucide-react';
import { memo, useCallback, useState } from 'react';

import { InterventionPanel, InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';

export const ClearTodosIntervention = memo(function ClearTodosIntervention({
  args,
  onArgsChange,
}: BuiltinInterventionProps) {
  const initial = args.mode === 'all' ? 'all' : 'completed';
  const [mode, setMode] = useState<'completed' | 'all'>(initial);

  const handleModeChange = useCallback(
    async (next: 'completed' | 'all') => {
      setMode(next);
      await onArgsChange?.({ mode: next });
    },
    [onArgsChange],
  );

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="选择要清除的待办范围，此操作不可撤销。"
        title="清除待办"
      />

      <InterventionPanel>
        <Flexbox gap={8}>
          <div
            className={interventionStyles.selectableOption}
            data-selected={mode === 'completed'}
            role="radio"
            aria-checked={mode === 'completed'}
            onClick={() => void handleModeChange('completed')}
          >
            <span className={interventionStyles.leadTitle} style={{ fontSize: 14 }}>
              仅已完成
            </span>
            <p className={interventionStyles.leadDesc}>保留进行中和未开始的任务</p>
          </div>
          <div
            className={interventionStyles.selectableOption}
            data-selected={mode === 'all'}
            role="radio"
            aria-checked={mode === 'all'}
            onClick={() => void handleModeChange('all')}
          >
            <div className={interventionStyles.selectableOptionRow}>
              <Trash2 size={16} style={{ color: 'var(--console-vars-color-error)', flexShrink: 0, marginBlockStart: 2 }} />
              <Flexbox gap={4} style={{ minWidth: 0 }}>
                <span className={interventionStyles.leadTitle} style={{ fontSize: 14, color: 'var(--console-vars-color-error)' }}>
                  全部清除
                </span>
                <p className={interventionStyles.leadDesc}>删除所有待办，包括未完成任务</p>
              </Flexbox>
            </div>
          </div>
        </Flexbox>
      </InterventionPanel>
    </Flexbox>
  );
});
