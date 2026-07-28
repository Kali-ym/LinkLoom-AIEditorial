import { fetchReportJson, fetchReportJsonDates } from '@/lib/api';
import { buildDailyIssueSummary } from '@/lib/dailyIssue';
import { todayInShanghai } from '@/lib/format';
import { DailyShell } from '@/components/DailyShell';
import { DailyMasthead } from '@/components/DailyMasthead';
import { DailyReportJsonView } from '@/components/DailyReportJsonView';
import { DailyFooter } from '@/components/DailyFooter';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'AI 日报' };

export default async function DailyTodayPage() {
  const today = todayInShanghai();
  const [report, dates] = await Promise.all([fetchReportJson(today), fetchReportJsonDates()]);

  if (!report) {
    return (
      <DailyShell current={today} dates={dates}>
        <DailyMasthead date={today} />
        <div className="px-5 sm:px-8 py-12 text-center text-muted">
          <p>{today} 的日报尚未生成。</p>
          <p className="mt-2 text-sm">今日日报尚未发布，请稍后再来查看。</p>
        </div>
        <DailyFooter
          current={today}
          available={dates}
          stats={{ events: 0, firsthand: 0, newModels: 0, sources: 0 }}
        />
      </DailyShell>
    );
  }

  const issue = buildDailyIssueSummary(today, dates, report);

  return (
    <DailyShell current={today} dates={dates} issue={issue}>
      <DailyMasthead
        date={today}
        vol={report.vol}
        stats={issue?.stats}
      />
      <DailyReportJsonView report={report} dates={dates} />
    </DailyShell>
  );
}
