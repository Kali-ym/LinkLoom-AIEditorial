import type { StaticConversation } from '../domain/types/conversation';
import type { Message } from '../domain/types';

/** Map index.html static conversation fixture to chat message list for the default topic. */
export function mapStaticConversationToMessages(
  conversation: StaticConversation,
): Message[] {
  const { prelude, user, assistant, followUpUser, followUpAssistant } = conversation;
  const assistantContent = [
    assistant.markdown.intro,
    ...assistant.markdown.bullets.map((b) => `- **${b.term}**：${b.detail}`),
    assistant.markdown.footer,
  ].join('\n\n');

  const preludeMessages: Message[] = prelude.flatMap((pair) => [
    {
      id: pair.user.id,
      role: 'user' as const,
      content: pair.user.text ?? '',
      createdAt: pair.user.time,
      text: pair.user.text,
    },
    {
      id: `assistant-${pair.user.id}`,
      role: 'assistant' as const,
      content: pair.assistant.content,
      createdAt: pair.assistant.time,
    },
  ]);

  return [
    ...preludeMessages,
    {
      id: user.id,
      role: 'user',
      content: user.text ?? user.linkLine?.url ?? '',
      createdAt: user.time,
      text: user.text,
      linkLine: user.linkLine,
      linkCard: user.linkCard,
    },
    { id: assistant.id, role: 'assistant', content: assistantContent, createdAt: assistant.time },
    {
      id: followUpUser.id,
      role: 'user',
      content: followUpUser.text ?? '',
      createdAt: followUpUser.time,
      text: followUpUser.text,
    },
    {
      id: 'assistant-followup',
      role: 'assistant',
      content: followUpAssistant.content,
      createdAt: followUpAssistant.time,
    },
  ];
}
