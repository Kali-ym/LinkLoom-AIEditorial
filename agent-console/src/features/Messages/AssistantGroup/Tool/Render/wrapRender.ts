import type { BuiltinRenderProps, BuiltinStreaming } from '../toolComponentTypes';
import { createElement, type ReactNode } from 'react';

type AnyRender = (props: BuiltinRenderProps<any, any>) => ReactNode;

/** §C.43/§C.45*/
export function wrapRender(Render: AnyRender): BuiltinStreaming {
  const Streaming: BuiltinStreaming = ({ args, messageId, apiName, identifier, toolCallId }) =>
    createElement(Render, { apiName, args, content: null, identifier, messageId, toolCallId });
  return Streaming;
}
