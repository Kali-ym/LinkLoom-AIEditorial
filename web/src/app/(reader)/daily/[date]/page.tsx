import { notFound } from 'next/navigation';
import { fetchReportJson, fetchReportJsonDates } from '@/lib/api';
import { buildDailyIssueSummary } from '@/lib/dailyIssue';
import { DailyShell } from '@/components/DailyShell';
import { DailyMasthead } from '@/components/DailyMasthead';
import { DailyReportJsonView } from '@/components/DailyReportJsonView';
import { DailyFooter } from '@/components/DailyFooter';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

interface Props {
  params: Promise<{ date: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { date } = await params;
  return { title: `AI 日报 · ${date}` };
}

export default async function DailyDatePage({ params }: Props) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [report, dates] = await Promise.all([
    fetchReportJson(date),
    fetchReportJsonDates()
  ]);

  if (!report) {
    return (
      <DailyShell current={date} dates={dates}>
        <DailyMasthead date={date} />
        <div className="px-5 sm:px-8 py-12 text-center text-muted">该日尚未生成日报。</div>
        <DailyFooter
          current={date}
          available={dates}
          stats={{ events: 0, firsthand: 0, newModels: 0, sources: 0 }}
        />
      </DailyShell>
    );
  }

  const issue = buildDailyIssueSummary(date, dates, report);

  return (
    <DailyShell current={date} dates={dates} issue={issue}>
      <DailyMasthead
        date={date}
        vol={report.vol}
        stats={issue?.stats}
      />
      <DailyReportJsonView report={report} dates={dates} />
    </DailyShell>
  );
}
