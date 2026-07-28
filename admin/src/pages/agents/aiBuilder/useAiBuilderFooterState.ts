import { useMemo } from 'react';
import { aiBuilderUi } from '../../../copy/aiBuilderUi';
import { getActivePlan } from './aiBuilderSessionDisplay';
import type { BuilderGateResult } from './builderGates';
import type { AiBuilderSession } from './sessionStorage';

export function useAiBuilderFooterState(
  activeSession: AiBuilderSession | undefined,
  buildMode: boolean,
  planMode: boolean,
  hasOpenClarification: boolean,
  draft: string,
  draftMentionsLength: number,
  isStreaming: boolean,
  isApplying: boolean,
  dryRunLoading: boolean,
  applyGate: BuilderGateResult
) {
  const canStop = isStreaming || isApplying;
  const canSend =
    !buildMode &&
    !hasOpenClarification &&
    (Boolean(draft.trim()) || draftMentionsLength > 0 || planMode);
  const activeBuildPlan = useMemo(() => getActivePlan(activeSession), [activeSession]);

  const buildFooterPrimaryAction = useMemo(() => {
    if (!buildMode || canStop) return null;
    if (isApplying) return { id: 'confirm_apply' as const, label: '写库中...', disabled: true };
    if (isStreaming)
      return { id: 'confirm_apply' as const, label: '生成构建计划...', disabled: true };
    if (dryRunLoading)
      return { id: 'confirm_apply' as const, label: aiBuilderUi.footerRunning, disabled: true };
    if (!activeBuildPlan)
      return { id: 'confirm_apply' as const, label: '等待构建计划', disabled: true };
    if (applyGate.ok)
      return {
        id: 'confirm_apply' as const,
        label: activeBuildPlan.dryRun?.riskPolicy?.hasHighRisk
          ? '高风险二次确认并写库'
          : '确认写库',
        disabled: false
      };
    return {
      id: 'confirm_apply' as const,
      label: applyGate.reason || aiBuilderUi.waitDryRun,
      disabled: true
    };
  }, [
    activeBuildPlan,
    applyGate.ok,
    applyGate.reason,
    buildMode,
    canStop,
    dryRunLoading,
    isApplying,
    isStreaming
  ]);

  return { canStop, canSend, buildFooterPrimaryAction };
}
