import { Icon } from '@lobehub/ui';
import { Loader2 } from 'lucide-react';
import { memo } from 'react';

import { AgentAvatar } from '../../../../utils/agentAvatar';

/** §C.19 — Agent row avatar 22px square. */
export const AgentItemAvatar = memo(function AgentItemAvatar({
  agentId,
  name,
  background,
  size = 22,
}: {
  agentId: string;
  name: string;
  background: string;
  size?: number;
}) {
  return <AgentAvatar agent={{ id: agentId, name }} background={background} size={size} />;
});

export const AgentItemAvatarLoading = memo(function AgentItemAvatarLoading() {
  return <Icon spin color="var(--console-vars-color-text-description)" icon={Loader2} size={18} />;
});
