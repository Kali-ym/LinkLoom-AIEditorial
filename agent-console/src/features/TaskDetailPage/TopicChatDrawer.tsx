import { Button, Drawer, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';

import { agentConsoleChatPath } from '../../constants/agentConsoleRoutes';
import { useRouteAgentId } from '../../hooks/useRouteAgentId';
import { useTaskDetailPageStore } from '../../stores/taskDetailPageStore';
import { taskDetailPageStrings } from './taskDetailPageStrings';

/** §C.54*/
export const TopicChatDrawer = memo(function TopicChatDrawer() {
  const navigate = useNavigate();
  const agentId = useRouteAgentId();
  const open = useTaskDetailPageStore((s) => s.chatDrawerOpen);
  const setOpen = useTaskDetailPageStore((s) => s.setChatDrawerOpen);
  const detail = useTaskDetailPageStore((s) => s.detail);

  return (
    <>
      <Button disabled={!detail?.topicId} onClick={() => setOpen(true)}>
        {taskDetailPageStrings.openTopicChat}
      </Button>
      <Drawer
        open={open}
        title={taskDetailPageStrings.topicChatTitle}
        width={420}
        onClose={() => setOpen(false)}
      >
        <Flexbox gap={12}>
          <Text type="secondary">{taskDetailPageStrings.topicChatHint}</Text>
          <Button
            type="primary"
            onClick={() => {
              if (!detail?.topicId || !agentId) return;
              navigate(agentConsoleChatPath(agentId, detail.topicId));
              setOpen(false);
            }}
          >
            {taskDetailPageStrings.goToTopic}
          </Button>
        </Flexbox>
      </Drawer>
    </>
  );
});
