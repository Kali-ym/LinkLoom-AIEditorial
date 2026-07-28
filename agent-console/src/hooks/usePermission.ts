import { useMemo } from 'react';

import { useTopicStore } from '../stores/topicStore';

export type PermissionKey = 'edit_own_content' | 'create_content';

interface PermissionResult {
  allowed: boolean;
  reason: string;
}

/** Mock permission*/
export function usePermission(key: PermissionKey): PermissionResult {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const topic = useTopicStore((s) => s.topics.find((t) => t.id === activeTopicId));

  return useMemo(() => {
    if (!topic || topic.status === 'waiting') {
      return {
        allowed: false,
        reason: key === 'create_content' ? '无创建权限' : '无分享权限',
      };
    }
    if (topic.status === 'temp' && key === 'edit_own_content') {
      return { allowed: false, reason: '请先发送消息' };
    }
    return { allowed: true, reason: '' };
  }, [key, topic]);
}
