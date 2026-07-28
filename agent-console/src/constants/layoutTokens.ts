import type { ActionIconProps } from '@lobehub/ui';

/**
 * Layout & component geometry — mirrored from
 * `sandbox/lobehub/packages/const/src/layoutTokens.ts` + agent route usage (§A.2–A.3).
 * Do not import from sandbox at runtime.
 */

// ── §A.2 layoutTokens.ts ────────────────────────────────────────────────────

export const CHAT_TEXTAREA_MAX_HEIGHT = 800;
export const CHAT_SIDEBAR_WIDTH = 280;
export const CONVERSATION_MIN_WIDTH = 960;

export const CHAT_PORTAL_WIDTH = 400;
export const CHAT_PORTAL_MAX_WIDTH = 1280;
export const CHAT_PORTAL_TOOL_UI_WIDTH = 600;

/** NavPanel drag bounds — `systemStatus.ts`, not layoutTokens.ts */
export const NAV_PANEL_MIN_WIDTH = 240;
export const NAV_PANEL_MAX_WIDTH = 400;
/** NavPanel persisted default*/
export const NAV_PANEL_DEFAULT_WIDTH = 320;

export const DESKTOP_HEADER_ICON_SIZE: ActionIconProps['size'] = { blockSize: 32, size: 20 };
export const DESKTOP_HEADER_ICON_SMALL_SIZE: ActionIconProps['size'] = { blockSize: 28, size: 16 };
export const MOBILE_HEADER_ICON_SIZE: ActionIconProps['size'] = { blockSize: 36, size: 22 };

// ── §A.3 component geometry ─────────────────────────────────────────────────

export const NAV_HEADER_HEIGHT = 44;
export const WORKING_SIDEBAR_HEADER_HEIGHT = 44;
export const WORKING_SIDEBAR_DEFAULT_WIDTH = 360;
export const WORKING_SIDEBAR_MIN_WIDTH = 300;
export const WORKING_SIDEBAR_MAX_WIDTH = 720;

export const CHAT_INPUT_DESKTOP_MAX_HEIGHT = 320;
export const CHAT_INPUT_MIN_HEIGHT = 36;
/** Persisted default*/
export const CHAT_INPUT_DEFAULT_HEIGHT = 32;
export const CONTROL_BAR_HEIGHT = 28;

export const AGENT_SWITCHER_AVATAR_SIZE = 28;
export const AGENT_HOME_AVATAR_SIZE = 64;

/** §C.11 chat message header — avatar height = 2.5× agent name font size. */
export const CHAT_AGENT_NAME_FONT_SIZE = 14;
export const CHAT_AGENT_AVATAR_SIZE = CHAT_AGENT_NAME_FONT_SIZE * 2.5;
export const STATUS_INDICATOR_BLOCK_SIZE = 24;
export const BACK_BOTTOM_BUTTON_SIZE = 36;

export const MINIMAP_PREVIEW_MIN_WIDTH = 240;
export const MINIMAP_PREVIEW_MAX_WIDTH = 360;
export const MENTION_MENU_MIN_WIDTH = 260;
export const MENTION_MENU_MAX_WIDTH = 360;
export const MENTION_MENU_MAX_HEIGHT = 360;

export const AGENT_SWITCH_PANEL_WIDTH = 240;
export const NAV_ITEM_ROW_HEIGHT = 36;
export const NAV_ITEM_ICON_BLOCK_SIZE = 28;
export const NAV_ITEM_ICON_SIZE = 18;

export const USER_BUBBLE_PADDING_BLOCK = 8;
export const USER_BUBBLE_PADDING_INLINE = 12;
export const USER_MESSAGE_PADDING_INLINE_START = 36;

export const TOPIC_UNREAD_DOT_SIZE = 6;
export const TOPIC_RUNNING_TIMER_MIN_WIDTH = 42;

export const QUEUE_FILE_THUMB_SIZE = 28;
export const QUEUE_CHIP_MAX_WIDTH = 160;
export const QUEUE_CHIP_HEIGHT = 28;

export const REVIEW_DEFAULT_EXPAND_BYTES = 100 * 1024;
export const REVIEW_DEFAULT_EXPAND_FILE_COUNT = 50;
