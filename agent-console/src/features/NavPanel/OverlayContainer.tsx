import { createContext, useContext } from 'react';

/** §C.50*/
export const OverlayContainerContext = createContext<HTMLDivElement | null>(null);

export function useOverlayContainer() {
  return useContext(OverlayContainerContext);
}
