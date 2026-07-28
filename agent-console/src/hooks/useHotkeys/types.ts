export interface HotkeyBinding {
  id: string;
  match: (e: KeyboardEvent) => boolean;
  handler: (e: KeyboardEvent) => void;
  /** When true, hotkey fires inside inputs/contenteditable. */
  enableOnContentEditable?: boolean;
  /** Dynamic gate — e.g. zen mode disables panel toggles. */
  enabled?: () => boolean;
}
