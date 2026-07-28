import { createContext, use } from 'react';

export type MessageActionType = {
  id: string;
  index: number;
  type: 'assistant' | 'assistantGroup' | 'user';
};

export const MessageItemActionElementPortialContext = createContext<HTMLDivElement | null>(null);
export const SetMessageItemActionElementPortialContext = createContext<
  (el: HTMLDivElement | null) => void
>(() => {});

export const MessageItemActionTypeContext = createContext<MessageActionType | null>(null);
export const SetMessageItemActionTypeContext = createContext<
  (ctx: MessageActionType | null) => void
>(() => {});

export const useMessageItemActionElementPortialContext = () =>
  use(MessageItemActionElementPortialContext);
export const useSetMessageItemActionElementPortialContext = () =>
  use(SetMessageItemActionElementPortialContext);
export const useMessageItemActionTypeContext = () => use(MessageItemActionTypeContext);
export const useSetMessageItemActionTypeContext = () => use(SetMessageItemActionTypeContext);
