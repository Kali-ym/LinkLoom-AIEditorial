import { ReactNode } from 'react';
import type { DailyIssueSummary, ReportDateEntry } from '@/lib/types';
import { DailyArchive } from './DailyArchive';
import { DailyArchiveMobile } from './DailyArchiveMobile';

interface Props {
  current: string;
  dates: ReportDateEntry[];
  issue?: DailyIssueSummary;
  children: ReactNode;
}

export function DailyShell({ current, dates, issue, children }: Props) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden border-l border-hairline bg-canvas">
      <DailyArchive dates={dates} current={current} issue={issue} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        <DailyArchiveMobile dates={dates} current={current} />
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}