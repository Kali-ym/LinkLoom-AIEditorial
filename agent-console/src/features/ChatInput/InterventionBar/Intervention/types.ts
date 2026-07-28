export type InteractionAction =
  | { type: 'submit'; payload: Record<string, unknown> }
  | { type: 'skip'; payload?: Record<string, unknown>; reason?: string }
  | { type: 'cancel'; payload?: Record<string, unknown> };

export interface BuiltinInterventionProps {
  args: Record<string, unknown>;
  messageId: string;
  apiName?: string;
  identifier?: string;
  actionsPortalTarget?: HTMLDivElement | null;
  onArgsChange?: (args: unknown) => void | Promise<void>;
  registerBeforeApprove?: (
    callbackId: string,
    callback: () => void | Promise<void>,
  ) => () => void;
  onInteractionAction?: (action: InteractionAction) => void | Promise<void>;
  interactionMode?: 'approval' | 'custom';
}

export interface InterventionRouterProps {
  actionsPortalTarget: HTMLDivElement | null;
  apiName: string;
  assistantGroupId?: string;
  assistantMessageId: string;
  toolMessageId: string;
  identifier: string;
  requestArgs: string;
  toolCallId: string;
  topicId: string;
  onResolved?: () => void;
  permissionId?: string;
  hitlKind?: string;
  hitlPrompt?: string;
  allowedActions?: string[];
}
