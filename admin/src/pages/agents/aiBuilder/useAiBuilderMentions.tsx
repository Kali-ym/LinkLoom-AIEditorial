import { useMemo } from 'react';
import type { Agent, AiBuilderMention, Skill, Workflow } from '../../../services/agentService';
import { MsIcon } from './aiBuilderMsIcon';
import {
  createAiBuilderMention,
  mentionIcon,
  mentionKey,
  mentionText,
  uniqueMentions
} from './aiBuilderMentions';
import type { AiBuilderSession } from './sessionStorage';

export function useAiBuilderMentions(
  agents: Agent[],
  skills: Skill[],
  workflows: Workflow[],
  mentionQuery: string,
  updateActiveSession: (
    patch: Partial<AiBuilderSession> | ((session: AiBuilderSession) => Partial<AiBuilderSession>)
  ) => void,
  onMentionPicked: () => void,
  focusEditor: () => void
) {
  const allMentionItems = useMemo(() => {
    const createItems: AiBuilderMention[] = [
      {
        type: 'create',
        target: 'agent',
        label: '创建 智能体',
        description: '新建一个可执行任务的 Agent'
      },
      {
        type: 'create',
        target: 'skill',
        label: '创建 技能',
        description: '新建 SKILL.md 和相关说明'
      },
      {
        type: 'create',
        target: 'workflow',
        label: '创建 工作流',
        description: '编排智能体、技能、工具和已有流程'
      }
    ];
    return {
      agents: [createItems[0], ...agents.map((agent) => createAiBuilderMention('agent', agent))],
      skills: [createItems[1], ...skills.map((skill) => createAiBuilderMention('skill', skill))],
      workflows: [
        createItems[2],
        ...workflows.map((workflow) => createAiBuilderMention('workflow', workflow))
      ]
    };
  }, [agents, skills, workflows]);

  const filteredMentionItems = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const filter = (items: AiBuilderMention[]) =>
      !q
        ? items
        : items.filter((item) =>
            `${item.label} ${item.description || ''} ${item.id || ''}`.toLowerCase().includes(q)
          );
    return {
      agents: filter(allMentionItems.agents),
      skills: filter(allMentionItems.skills),
      workflows: filter(allMentionItems.workflows)
    };
  }, [allMentionItems, mentionQuery]);

  const addMention = (mention: AiBuilderMention) => {
    updateActiveSession((session) => ({
      draftMentions: uniqueMentions([...(session.draftMentions || []), mention]),
      mentions: uniqueMentions([...(session.mentions || []), mention]),
      draft: (session.draft || '').replace(/@[\w\u4e00-\u9fa5 -]*$/, '').trimStart()
    }));
    onMentionPicked();
    focusEditor();
  };

  const removeDraftMention = (mention: AiBuilderMention) => {
    updateActiveSession((session) => {
      const nextDraftMentions = (session.draftMentions || []).filter(
        (item) => mentionKey(item) !== mentionKey(mention)
      );
      const mentionStillUsed = session.messages.some((message) =>
        (message.mentions || []).some((item) => mentionKey(item) === mentionKey(mention))
      );
      return {
        draftMentions: nextDraftMentions,
        mentions: mentionStillUsed
          ? session.mentions
          : session.mentions.filter((item) => mentionKey(item) !== mentionKey(mention))
      };
    });
  };

  const renderMentionChip = (mention: AiBuilderMention, removable = false) => (
    <span
      key={mentionKey(mention)}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-hairline-soft bg-surface-soft px-2 py-1 text-xs font-semibold text-text-charcoal shadow-subtle dark:border-white/10 dark:bg-canvas/[0.08] dark:text-slate-100"
    >
      <MsIcon name={mentionIcon(mention)} size={16} className="text-text-slate" />
      <span className="truncate">{mentionText(mention)}</span>
      {removable && (
        <button
          type="button"
          onClick={() => removeDraftMention(mention)}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-stone hover:bg-hairline hover:text-text-charcoal dark:hover:bg-canvas/10"
        >
          <MsIcon name="close" size={14} />
        </button>
      )}
    </span>
  );

  const renderMentionGroup = (title: string, items: AiBuilderMention[]) =>
    items.length ? (
      <div className="py-1">
        <p className="px-3 py-1 text-[11px] font-semibold text-text-stone">{title}</p>
        {items.map((item) => (
          <button
            key={mentionKey(item)}
            type="button"
            onClick={() => addMention(item)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-text-charcoal hover:bg-surface dark:text-text-secondary dark:hover:bg-canvas/[0.06]"
          >
            <MsIcon name={mentionIcon(item)} size={18} className="text-text-slate" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{item.label}</span>
              {item.description && (
                <span className="block truncate text-xs text-text-stone">{item.description}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    ) : null;

  const quickMentions: AiBuilderMention[] = [
    {
      type: 'create',
      target: 'workflow',
      label: '创建 工作流',
      description: '从目标倒推步骤和所需资源'
    },
    {
      type: 'create',
      target: 'agent',
      label: '创建 智能体',
      description: '生成 prompt、工具和技能绑定'
    },
    { type: 'create', target: 'skill', label: '创建 技能', description: '生成 SKILL.md 和操作说明' }
  ];

  const applyQuickMention = (mention: AiBuilderMention, prompt: string) => {
    addMention(mention);
    updateActiveSession((session) => ({
      draft: session.draft?.trim() ? session.draft : prompt
    }));
  };

  return {
    filteredMentionItems,
    quickMentions,
    applyQuickMention,
    renderMentionChip,
    renderMentionGroup
  };
}
