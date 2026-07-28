import type { FC, ReactNode } from 'react';

export interface MarkdownElementProps<T = Record<string, unknown>> {
  children: ReactNode;
  id: string;
  node: {
    properties: T;
  };
  tagName: string;
  type: string;
}

export type MarkdownPluginScope = 'user' | 'assistant' | 'all';

export interface MarkdownElement {
  Component: FC<MarkdownElementProps>;
  rehypePlugin?: unknown;
  remarkPlugin?: unknown;
  scope: MarkdownPluginScope;
  tag: string;
}
