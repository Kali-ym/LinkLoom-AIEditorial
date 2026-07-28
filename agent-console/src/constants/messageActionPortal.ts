/** Upstream `const/messageActionPortal.ts` — action bar portal anchors */

export const MESSAGE_ACTION_BAR_PORTAL_ATTRIBUTES = {
  user: 'data-user-action-bar-portal',
  /** lobehub typo preserved for selector parity */
  assistant: 'data-assitant-action-bar-portal',
  assistantGroup: 'data-assistant-group-action-bar-portal',
} as const;

export const MESSAGE_ACTION_BAR_PORTAL_SELECTORS = {
  user: `[${MESSAGE_ACTION_BAR_PORTAL_ATTRIBUTES.user}]`,
  assistant: `[${MESSAGE_ACTION_BAR_PORTAL_ATTRIBUTES.assistant}]`,
  assistantGroup: `[${MESSAGE_ACTION_BAR_PORTAL_ATTRIBUTES.assistantGroup}]`,
} as const;
