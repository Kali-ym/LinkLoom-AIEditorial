import { ReactNode } from 'react';

export default function DailyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-0 overflow-hidden lg:left-[256px] lg:top-0">
      <div className="h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}