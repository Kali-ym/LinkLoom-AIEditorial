import { createContext, type RefObject } from 'react';

/** Portal target for ChatInput fullscreen — mirrors `LayoutContainerContext`. */
export const LayoutContainerContext = createContext<RefObject<HTMLDivElement | null>>({
  current: null,
});
