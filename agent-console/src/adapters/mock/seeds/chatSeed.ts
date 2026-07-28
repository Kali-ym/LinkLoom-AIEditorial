import { CHANGELOG_DEMO_MESSAGES } from '../../../fixtures/changelogDemo';
import { INTERVENTION_DEMO_MESSAGES } from '../../../fixtures/interventionDemo';
import { MSG_TYPES_DEMO_MESSAGES } from '../../../fixtures/msgTypesDemo';
import { PORTAL_DM_MESSAGES, PORTAL_THREAD_MESSAGES } from '../../../fixtures/portalThreadMessages';
import { RENDER_TOOLS_DEMO_MESSAGES } from '../../../fixtures/renderToolsDemo';
import { STATIC_CONVERSATION } from '../../../fixtures/staticConversation';
import { STREAMING_TOOLS_DEMO_MESSAGES } from '../../../fixtures/streamingToolsDemo';
import { USER_MESSAGE_EXTRAS } from '../../../fixtures/userMessageExtras';
import { mapStaticConversationToMessages } from '../../mapStaticConversation';
import { enrichMessagesToolSettings } from '../enrichMessagesToolSettings';
import type { Message } from '../../../domain/types';
import { MOCK_DEFAULT_TOPIC_ID } from '../constants';

function enrichTopicMessages(messages: Message[]): Message[] {
  return enrichMessagesToolSettings(messages);
}

export function getMockMessagesByTopicId(): Record<string, Message[]> {
  const activeTopicId = MOCK_DEFAULT_TOPIC_ID;
  return {
    [activeTopicId]: enrichTopicMessages([
      ...mapStaticConversationToMessages(STATIC_CONVERSATION),
      ...USER_MESSAGE_EXTRAS,
      ...PORTAL_THREAD_MESSAGES,
      ...PORTAL_DM_MESSAGES,
    ]),
    approval: enrichTopicMessages(INTERVENTION_DEMO_MESSAGES),
    changelog: enrichTopicMessages(CHANGELOG_DEMO_MESSAGES),
    'msg-types': enrichTopicMessages(MSG_TYPES_DEMO_MESSAGES),
    'streaming-tools': enrichTopicMessages(STREAMING_TOOLS_DEMO_MESSAGES),
    'render-tools': enrichTopicMessages(RENDER_TOOLS_DEMO_MESSAGES),
  };
}

export function getMockStaticConversation() {
  return STATIC_CONVERSATION;
}
