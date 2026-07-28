import { Icon } from '@lobehub/ui';
import { SkillsIcon } from '@lobehub/ui/icons';
import { Bot, File, MessageSquareText, Wrench } from 'lucide-react';
import { useMemo } from 'react';

import { filterBindingsByPlugins } from '../../../../domain/utils/agentPluginBindings';
import { filterCatalogToolsForAgent } from '../../../../domain/utils/adminExclusiveBindings';
import { useAgentStore, useTopicStore, useWorkspaceStore } from '../../../../stores';
import MentionItemIcon from './MentionItemIcon';
import { buildMentionFileMenuItems } from './mentionFileItems';
import {
  MAX_AGENT_MENTION_ITEMS,
  MAX_TOPIC_MENTION_LABEL,
  MENTION_CATEGORY_LABELS,
} from './constants';
import type { MentionCategory } from './types';

export function useMentionCategories(): MentionCategory[] {
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const agentFiles = useAgentStore((s) => s.getActivePlusState().files);
  const enabledPlugins = useAgentStore((s) => s.getActivePlusState().plugins);
  const skillCatalog = useWorkspaceStore((s) => s.skillCatalog);
  const storedMentionFiles = useWorkspaceStore((s) => s.inputMenu.mentionFiles);
  const topics = useTopicStore((s) => s.topics);
  const activeTopicId = useTopicStore((s) => s.activeTopicId);

  return useMemo(() => {
    const categories: MentionCategory[] = [];

    const agentItems = skillCatalog.agents
      .filter((a) => a.id !== activeAgentId)
      .slice(0, MAX_AGENT_MENTION_ITEMS)
      .map((agent) => ({
        icon: (
          <span
            style={{
              background: agent.gradient,
              borderRadius: 6,
              display: 'block',
              height: 24,
              width: 24,
            }}
          />
        ),
        key: `agent-${agent.id}`,
        label: agent.name,
        metadata: {
          id: agent.id,
          timestamp: 0,
          type: 'agent' as const,
        },
      }));

    if (agentItems.length > 0) {
      categories.push({
        id: 'agent',
        icon: <Icon icon={Bot} size={16} />,
        items: agentItems,
        label: MENTION_CATEGORY_LABELS.agent,
      });
    }

    if (topics.length > 0) {
      const topicItems = topics
        .filter((t) => t.id !== activeTopicId)
        .map((topic) => {
          const title = topic.title || '未命名话题';
          const label =
            title.length > MAX_TOPIC_MENTION_LABEL
              ? `${title.slice(0, MAX_TOPIC_MENTION_LABEL)}...`
              : title;
          return {
            icon: <Icon icon={MessageSquareText} size={16} />,
            key: `topic-${topic.id}`,
            label,
            metadata: {
              topicId: topic.id,
              topicTitle: topic.title,
              timestamp: topic.updatedAt ? Date.parse(topic.updatedAt) || 0 : 0,
              type: 'topic' as const,
            },
          };
        });

      if (topicItems.length > 0) {
        categories.push({
          id: 'topic',
          icon: <Icon icon={MessageSquareText} size={16} />,
          items: topicItems,
          label: MENTION_CATEGORY_LABELS.topic,
        });
      }
    }

    const enabledUserSkills = filterBindingsByPlugins(skillCatalog.userSkills, enabledPlugins);
    const enabledAgentSkills = filterBindingsByPlugins(skillCatalog.agentSkills, enabledPlugins);

    const skillItems = [
      ...enabledUserSkills.map((s) => ({
        icon: <MentionItemIcon category="skill" label={s.name} />,
        key: `skill-${s.id}`,
        label: s.name,
        metadata: {
          actionCategory: 'skill' as const,
          actionType: s.id,
          timestamp: 0,
          type: 'skill' as const,
        },
      })),
      ...enabledAgentSkills.map((s) => ({
        icon: <MentionItemIcon category="skill" label={s.name} />,
        key: `agent-skill-${s.id}`,
        label: s.name,
        metadata: {
          actionCategory: 'agentSkill' as const,
          actionType: s.id,
          timestamp: 0,
          type: 'skill' as const,
        },
      })),
    ];

    if (skillItems.length > 0) {
      categories.push({
        id: 'skill',
        icon: <Icon icon={SkillsIcon} size={16} />,
        items: skillItems,
        label: MENTION_CATEGORY_LABELS.skill,
      });
    }

    const toolItems = filterBindingsByPlugins(
      filterCatalogToolsForAgent(activeAgentId, skillCatalog.tools),
      enabledPlugins,
    ).map((t) => ({
      icon: <MentionItemIcon category="tool" label={t.name} />,
      key: `tool-${t.id}`,
      label: t.name,
      metadata: {
        actionCategory: 'tool' as const,
        actionType: t.id,
        timestamp: 0,
        type: 'tool' as const,
      },
    }));

    if (toolItems.length > 0) {
      categories.push({
        id: 'tool',
        icon: <Icon icon={Wrench} size={16} />,
        items: toolItems,
        label: MENTION_CATEGORY_LABELS.tool,
      });
    }

    const fileItems = buildMentionFileMenuItems({
      agentFiles,
      storedFiles: storedMentionFiles,
    }).map((item) => ({
      ...item,
      icon: <Icon icon={File} size={16} />,
    }));

    if (fileItems.length > 0) {
      categories.push({
        id: 'localFile',
        icon: <Icon icon={File} size={16} />,
        items: fileItems,
        label: MENTION_CATEGORY_LABELS.file,
      });
    }

    return categories;
  }, [activeAgentId, activeTopicId, agentFiles, enabledPlugins, skillCatalog, storedMentionFiles, topics]);
}
