import type { FC } from 'react';

/** §C.43*/
export interface BuiltinStreamingProps<A = unknown> {
  apiName: string;
  args: A;
  identifier: string;
  messageId: string;
  toolCallId: string;
}

export type BuiltinStreaming<A = any> = FC<BuiltinStreamingProps<A>>;

/** §C.43 / wrapRender — 完成态 Render 复用为 Streaming */
export interface BuiltinRenderProps<A = unknown, S = unknown> extends BuiltinStreamingProps<A> {
  content?: string | null;
  pluginState?: S;
}

/** §C.45*/
export type BuiltinRender<A = any, S = any> = FC<BuiltinRenderProps<A, S>>;

export interface BuiltinStreamingRegistryEntry {
  apiName: string;
  identifier: string;
  streaming: BuiltinStreaming;
}

export interface BuiltinRenderRegistryEntry {
  apiName: string;
  identifier: string;
  render: BuiltinRender;
}
