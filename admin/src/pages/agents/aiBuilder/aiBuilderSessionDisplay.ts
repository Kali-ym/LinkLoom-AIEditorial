import type { AiBuildTarget, AiBuilderMention } from '../../../services/agentService';
import type { AiBuilderSession } from './sessionStorage';

function targetLabel(target?: AiBuildTarget) {
  if (target === 'agent') return '智能体';
  if (target === 'skill') return '技能';
  if (target === 'workflow') return '工作流';
  return '资源';
}

function mentionText(mention: AiBuilderMention) {
  if (mention.type === 'create') return `@创建 ${targetLabel(mention.target)}`;
  return `@${mention.label}`;
}

export function getActivePlan(session?: AiBuilderSession | null) {
  if (!session) return null;
  const artifact = [...session.messages]
    .reverse()
    .find(
      (message) => message.kind === 'plan_artifact' && !message.superseded && message.planSnapshot
    );
  return artifact?.planSnapshot || session.plan || null;
}

export function getActiveDraft(session?: AiBuilderSession | null) {
  if (!session) return null;
  const artifact = [...session.messages]
    .reverse()
    .find(
      (message) =>
        message.kind === 'planning_artifact' && !message.superseded && message.draftSnapshot
    );
  return artifact?.draftSnapshot || session.activeDraft || null;
}

export function primaryMention(session?: AiBuilderSession | null) {
  if (!session) return null;
  return (session.draftMentions || [])[0] || session.mentions[0] || null;
}

/** 从 Plan 模式流式回复中剥离末尾 PlanDraft JSON，保留规划反思文本。 */
export function extractPlanReflectionText(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';

  const markerIndex = trimmed.search(/\{[\s\S]*?"(title|summary|questions|proposedResources)"\s*:/);
  if (markerIndex <= 0) return trimmed;

  return trimmed.slice(0, markerIndex).trim();
}

export function emptyStateCopy(mention: AiBuilderMention | null) {
  if (!mention) {
    return {
      headline: '描述你想构建或修改的能力',
      subtext: '用 @ 引用资源，或从下面选择一个起点。'
    };
  }
  if (mention.type === 'create') {
    const label = targetLabel(mention.target);
    return {
      headline: `描述这个${label}要做什么`,
      subtext: `已选择 @创建 ${label}，补充目标描述后即可${label === '工作流' ? '编排' : '生成'}。`
    };
  }
  return {
    headline: `描述要如何修改「${mention.label}」`,
    subtext: '补充修改目标，或通过 @ 调整引用资源。'
  };
}

export function sessionPreview(session: AiBuilderSession) {
  const plan = getActivePlan(session);
  const draft = getActiveDraft(session);
  if (plan?.status === 'applied') {
    return `写库完成 · ${plan.summary.replace(/\s+/g, ' ').slice(0, 34)}`;
  }
  if (plan) {
    const errors = plan.dryRun?.errors.length || 0;
    return `构建评审 · ${plan.summary.replace(/\s+/g, ' ').slice(0, 28)}${errors ? ` · ${errors} 个阻塞` : ''}`;
  }
  if (draft) {
    return `计划草稿 · ${(draft.title || draft.summary).replace(/\s+/g, ' ').slice(0, 34)}`;
  }
  const latest = [...session.messages].reverse().find((message) => message.content.trim());
  if (latest?.content) return latest.content.replace(/\s+/g, ' ').slice(0, 42);
  if ((session.draft || '').trim())
    return `草稿：${session.draft!.replace(/\s+/g, ' ').slice(0, 36)}`;
  if (session.mentions.length > 0 || (session.draftMentions || []).length > 0)
    return '等待描述目标…';
  return '用 @ 引用资源开始';
}

export function displaySessionTitle(session: AiBuilderSession) {
  if (session.messages.length > 0 && session.title && session.title !== '新的 Builder 会话') {
    return session.title;
  }
  if ((session.draft || '').trim()) return session.draft!.trim().slice(0, 22);
  const mention = primaryMention(session);
  if (mention) return mentionText(mention);
  if (session.title && session.title !== '新的 Builder 会话') return session.title;
  return '新会话';
}

export function formatSessionTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
