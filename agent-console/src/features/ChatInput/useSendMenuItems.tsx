import { Icon, type MenuProps } from '@lobehub/ui';
import { BotMessageSquare, Check, MessageSquarePlus } from 'lucide-react';
import { useMemo } from 'react';

import { useAddUserMessageHotkey } from '../../hooks/useHotkeys';
import { useConfigStore } from '../../stores';
import { useDevMessageActions } from './useDevMessageActions';

/** §C.18 dev send menu*/
export function useSendMenuItems(): MenuProps['items'] {
  const useCmdEnterToSend = useConfigStore((s) => s.useCmdEnterToSend);
  const setUseCmdEnterToSend = useConfigStore((s) => s.setUseCmdEnterToSend);
  const { addAIMessage, addUserMessage } = useDevMessageActions();

  useAddUserMessageHotkey(addUserMessage);

  return useMemo(
    () => [
      {
        icon: !useCmdEnterToSend ? <Icon icon={Check} /> : <div />,
        key: 'sendWithEnter',
        label: 'Enter 发送',
        onClick: () => setUseCmdEnterToSend(false),
      },
      {
        icon: useCmdEnterToSend ? <Icon icon={Check} /> : <div />,
        key: 'sendWithCmdEnter',
        label: 'Cmd+Enter 发送',
        onClick: () => setUseCmdEnterToSend(true),
      },
      { type: 'divider' },
      {
        icon: <Icon icon={BotMessageSquare} />,
        key: 'addAI',
        label: '添加 AI 消息',
        onClick: addAIMessage,
      },
      {
        icon: <Icon icon={MessageSquarePlus} />,
        key: 'addUser',
        label: '添加用户消息',
        onClick: addUserMessage,
      },
    ],
    [addAIMessage, addUserMessage, setUseCmdEnterToSend, useCmdEnterToSend],
  );
}
