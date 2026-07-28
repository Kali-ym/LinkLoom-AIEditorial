import type { MarkdownProps } from '@lobehub/ui';
import { useMemo } from 'react';

import { userMarkdownElements } from '../Markdown/plugins';
import type { MarkdownElementProps, MarkdownPluginScope } from '../Markdown/plugins/type';
import { UserMarkdownAnchor } from './UserUrlChip';

export type ConversationMarkdownScope = Exclude<MarkdownPluginScope, 'all'>;

function elementsForScope(scope: ConversationMarkdownScope) {
  return userMarkdownElements.filter((element) => element.scope === 'all' || element.scope === scope);
}

function buildMarkdownComponents(
  elements: ReturnType<typeof elementsForScope>,
  messageId: string,
): NonNullable<MarkdownProps['components']> {
  const custom = Object.fromEntries(
    elements.map((element) => {
      const Component = element.Component;
      const render = (props: MarkdownElementProps) => <Component {...props} id={messageId} />;
      return [element.tag, render] as const;
    }),
  );
  return {
    ...custom,
    a: UserMarkdownAnchor,
  };
}

export interface ConversationMarkdownOptions {
  animated?: boolean;
  enableStream?: boolean;
}

export function useConversationMarkdown(
  messageId: string,
  scope: ConversationMarkdownScope,
  options: ConversationMarkdownOptions = {},
): Partial<MarkdownProps> {
  const { animated, enableStream } = options;

  return useMemo(() => {
    const elements = elementsForScope(scope);
    const remarkPlugins = elements
      .map((element) => element.remarkPlugin)
      .filter(Boolean) as NonNullable<MarkdownProps['remarkPlugins']>;

    return {
      animated,
      components: buildMarkdownComponents(elements, messageId),
      enableStream,
      remarkPlugins,
    } satisfies Partial<MarkdownProps>;
  }, [animated, enableStream, messageId, scope]);
}

export function useUserMessageMarkdown(messageId: string): Partial<MarkdownProps> {
  return useConversationMarkdown(messageId, 'user', { enableStream: false });
}
