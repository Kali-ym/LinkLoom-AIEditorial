import { useCallback } from 'react';

import { readEditorPlainText } from './editor/editorText';
import {
  useChatStore,
  useInputStore,
  useRouteStore,
  useTopicStore,
} from '../../stores';

/** §C.18*/
export function useDevMessageActions() {
  const addAIMessage = useCallback(() => {
    const topicId = useTopicStore.getState().activeTopicId;
    useRouteStore.getState().showConversation();
    useChatStore.getState().addAIMessage(topicId, '');
    const editor = useInputStore.getState().mainEditor;
    editor?.cleanDocument();
    editor?.focus();
  }, []);

  const addUserMessage = useCallback(() => {
    const topicId = useTopicStore.getState().activeTopicId;
    const editor = useInputStore.getState().mainEditor;
    const message = readEditorPlainText(editor).trim();
    if (!message) return;
    useRouteStore.getState().showConversation();
    useChatStore.getState().addUserMessage(topicId, message);
    editor?.cleanDocument();
    editor?.focus();
  }, []);

  return { addAIMessage, addUserMessage };
}
