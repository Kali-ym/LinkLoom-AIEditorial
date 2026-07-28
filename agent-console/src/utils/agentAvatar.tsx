import { Avatar, Icon } from '@lobehub/ui';
import {
  Code2,
  Palette,
  Rss,
  Shield,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { memo, type ReactNode } from 'react';

import type { Agent } from '../domain/types';

const AGENT_ICON_BY_ID: Partial<Record<string, LucideIcon>> = {
  code: Code2,
  design: Palette,
  rss: Rss,
  'group-collab': Users,
  topic_copilot: Sparkles,
  super_admin: Shield,
};

function iconForAgentId(agentId: string): LucideIcon | undefined {
  return AGENT_ICON_BY_ID[agentId];
}

export function resolveAgentAvatar(
  agent: Pick<Agent, 'id' | 'name'>,
  iconSize = 16,
): string | ReactNode {
  const IconComponent = iconForAgentId(agent.id);
  if (IconComponent) {
    return <Icon icon={IconComponent} size={iconSize} />;
  }
  return agent.name.slice(0, 1);
}

export const AgentAvatar = memo(function AgentAvatar({
  agent,
  background,
  iconSize,
  shape = 'square',
  size,
}: {
  agent: Pick<Agent, 'id' | 'name'>;
  background?: string;
  iconSize?: number;
  shape?: 'circle' | 'square';
  size: number;
}) {
  const resolvedIconSize = iconSize ?? Math.max(12, Math.round(size * 0.58));
  return (
    <Avatar
      avatar={resolveAgentAvatar(agent, resolvedIconSize)}
      background={background}
      shape={shape}
      size={size}
    />
  );
});
