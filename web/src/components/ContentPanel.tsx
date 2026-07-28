import { ReactNode } from 'react';

/** Full-bleed content surface (no floating card chrome). */
export function ContentPanel({
  children,
  className = ''
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full min-h-full bg-canvas ${className}`}>
      {children}
    </div>
  );
}
