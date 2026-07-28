import { createContext, useContext, type ReactNode } from 'react';

export type ActionBarContextValue = {
  onUploadClick?: () => void;
  dropdownPlacement?: 'top' | 'topLeft' | 'topRight' | 'bottom';
};

const ActionBarContext = createContext<ActionBarContextValue>({});

export function ActionBarProvider({
  value,
  children,
}: {
  value: ActionBarContextValue;
  children: ReactNode;
}) {
  return <ActionBarContext value={value}>{children}</ActionBarContext>;
}

export function useActionBarContext(): ActionBarContextValue {
  return useContext(ActionBarContext);
}
