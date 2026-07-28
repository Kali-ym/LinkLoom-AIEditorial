import type { DailyDigestStats, DailyIssueSummary, DailyReportJson, ReportDateEntry } from './types';

export type { DailyIssueSummary };

export function buildDailyIssueSummary(
  current: string,
  dates: ReportDateEntry[],
  report: DailyReportJson | null | undefined
): DailyIssueSummary | undefined {
  if (!report) return undefined;

  const storyCount =
    report.stats?.totalStories ??
    report.sections.reduce((s, sec) => s + (sec.items?.length || 0), 0);

  return {
    storyCount,
    stats: {
      events: storyCount,
      firsthand: report.stats?.primaryReports ?? 0,
      newModels: report.stats?.newModels ?? 0,
      sources: report.stats?.sources ?? 0
    },
    vol: report.vol
  };
}
