import type { AiBuildPlan } from '../../../services/agentService';
import type { MessageDialogOptions } from '../../../context/MessageDialogContext';

export function buildApplyConfirmDialog(plan: AiBuildPlan): MessageDialogOptions {
  const stats = {
    agents: plan.resourceChanges.filter((change) => change.action.includes('Agent')).length,
    skills: plan.resourceChanges.filter((change) => change.action.includes('Skill')).length,
    workflows: plan.resourceChanges.filter((change) => change.action.includes('Workflow')).length
  };
  const highRiskIds = plan.dryRun?.riskPolicy?.highRiskChangeIds || [];
  const updateTargets = (plan.dryRun?.changes || [])
    .filter((change) => change.operation === 'update')
    .map((change) => `${change.title} (${change.action})`);
  const hasHighRisk = highRiskIds.length > 0;
  const bullets = [
    `资源数量：${stats.agents} 个智能体、${stats.skills} 个技能文件、${stats.workflows} 个工作流`,
    updateTargets.length
      ? `更新对象：${updateTargets.slice(0, 8).join('、')}${updateTargets.length > 8 ? ` 等 ${updateTargets.length} 项` : ''}`
      : '更新对象：无',
    hasHighRisk ? `高风险项：${highRiskIds.join('、')}` : '高风险项：无'
  ];
  return {
    title: '确认写库',
    message: [
      '确认写库前请核对以下变更：',
      bullets.map((item) => `· ${item}`).join('\n'),
      '写库不是完整事务，失败时可能产生部分写入；当前版本不会自动回滚。'
    ].join('\n\n'),
    confirmLabel: '确认写库',
    cancelLabel: '取消',
    variant: hasHighRisk ? 'danger' : 'warning',
    confirmTone: hasHighRisk ? 'danger' : 'default'
  };
}
