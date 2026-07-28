import { useMemo } from 'react';

import type { ChatInputActionKey } from '../features/ChatInput/ActionBar/config';
import { useModelSupportImageOutput } from './useModelSupportImageOutput';
import { useAgentStore } from '../stores';

const LEFT_ACTIONS: ChatInputActionKey[] = ['model', 'plus'];

const CONTEXT_WINDOW_RIGHT: ChatInputActionKey[] = ['contextWindow'];
const PROMPT_TRANSFORM_RIGHT: ChatInputActionKey[] = ['promptTransform', 'contextWindow'];

/** §C.38*/
export function useMainChatInputActions() {
  const model = useAgentStore((s) => s.getActivePlusState().model);
  const provider = useAgentStore((s) => s.getActivePlusState().provider);
  const supportsImageOutput = useModelSupportImageOutput(model, provider);

  const leftActions = useMemo(() => LEFT_ACTIONS, []);
  const rightActions = useMemo(
    () => (supportsImageOutput ? PROMPT_TRANSFORM_RIGHT : CONTEXT_WINDOW_RIGHT),
    [supportsImageOutput],
  );

  return { leftActions, rightActions, supportsImageOutput };
}
