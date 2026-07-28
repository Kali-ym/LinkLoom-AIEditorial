import React from 'react';
import type { FeedAdminStats } from '../../../services/feedService';
import type { TaskLog } from '../../../services/scheduleService';
import { computeDailyTrend, formatLastCommit, formatUptime } from '../utils/format';

export interface SystemStats {
  todayCount?: number;
  yesterdayCount?: number;
  uptime?: number;
  lastCommit?: string | null;
  lastCommitPlatform?: string | null;
  aiStatus?: string;
}

interface Props {
  adminStats: FeedAdminStats | null;
  sysStats: SystemStats | null;
  logs: TaskLog[];
}

type Tone =
  | 'yellow'
  | 'lavender'
  | 'teal'
  | 'coral'
  | 'rose'
  | 'ink'
  | 'canvas';

type GradientAccent = 'primary' | 'purple';

interface FeaturedCardProps {
  label: string;
  icon: string;
  value: React.ReactNode;
  accent?: GradientAccent;
  hint?: React.ReactNode;
  trend?: React.ReactNode;
}

interface CompactCardProps {
  label: string;
  icon: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: React.ReactNode;
}

const GRADIENT_ACCENTS: Record<
  GradientAccent,
  { gradient: string; valueTone: string; subText: string; iconBg: string; hoverBorder: string; decoIcon: string }
> = {
  primary: {
    gradient: 'from-primary/10 via-primary/5 to-transparent',
    valueTone: 'text-primary',
    subText: 'text-text-slate dark:text-text-secondary',
    iconBg: 'bg-primary/10 text-primary',
    hoverBorder: 'hover:border-primary/30',
    decoIcon: 'text-primary',
  },
  purple: {
    gradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
    valueTone: 'text-purple-500',
    subText: 'text-text-slate dark:text-text-secondary',
    iconBg: 'bg-purple-500/10 text-purple-500',
    hoverBorder: 'hover:border-purple-400/30',
    decoIcon: 'text-purple-500',
  },
};

const TONE_STYLES: Record<Tone, { bg: string; text: string; subText: string; hover: string }> = {
  yellow: {
    bg: 'bg-surface-yellow',
    text: 'text-yellow-dark',
    subText: 'text-yellow-dark/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5',
  },
  lavender: {
    bg: 'bg-surface-lavender',
    text: 'text-ink-deep',
    subText: 'text-ink-deep/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5',
  },
  teal: {
    bg: 'bg-teal-light',
    text: 'text-moss-dark',
    subText: 'text-moss-dark/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5',
  },
  coral: {
    bg: 'bg-coral-light',
    text: 'text-coral-dark',
    subText: 'text-coral-dark/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5',
  },
  rose: {
    bg: 'bg-rose-light',
    text: 'text-ink',
    subText: 'text-ink/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5',
  },
  ink: {
    bg: 'bg-ink dark:bg-ink',
    text: 'text-white',
    subText: 'text-white/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5',
  },
  canvas: {
    bg: 'bg-canvas dark:bg-surface-dark border border-hairline-soft dark:border-white/5',
    text: 'text-text-ink dark:text-white',
    subText: 'text-text-slate dark:text-text-secondary',
    hover: 'hover:shadow-subtle hover:-translate-y-0.5 hover:border-hairline-strong dark:hover:border-white/10',
  },
};

const FeaturedCard: React.FC<FeaturedCardProps> = ({
  label,
  icon,
  value,
  accent = 'primary',
  hint,
  trend,
}) => {
  const a = GRADIENT_ACCENTS[accent];
  return (
    <div
      className={`relative overflow-hidden rounded-4xl bg-canvas dark:bg-surface-dark border border-hairline-soft dark:border-white/5 p-7 min-h-[148px] group transition-all duration-200 ease-out hover:shadow-card hover:-translate-y-0.5 ${a.hoverBorder}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${a.gradient} pointer-events-none`} />
      <span
        className={`material-symbols-outlined absolute -right-4 -bottom-4 text-[140px] ${a.decoIcon} opacity-[0.08] pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 group-hover:opacity-[0.12]`}
      >
        {icon}
      </span>
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${a.iconBg}`}>
            <span className="material-symbols-outlined text-[18px] fill">{icon}</span>
          </div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${a.subText}`}>
            {label}
          </p>
        </div>
        <div className="flex items-baseline gap-3">
          <p className={`text-[44px] leading-none font-medium tabular-nums tracking-tight ${a.valueTone}`}>
            {value}
          </p>
          {trend}
        </div>
        {hint && <p className={`text-[13px] ${a.subText}`}>{hint}</p>}
      </div>
    </div>
  );
};

const CompactCard: React.FC<CompactCardProps> = ({ label, icon, value, tone = 'canvas', hint }) => {
  const s = TONE_STYLES[tone];
  return (
    <div
      className={`rounded-3xl ${s.bg} px-5 py-4 min-h-[96px] flex flex-col justify-center transition-all duration-200 ease-out cursor-default ${s.hover}`}
    >
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${s.subText} mb-1.5`}>
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className={`text-[22px] leading-none font-medium tabular-nums truncate ${s.text}`}>
        {value}
      </p>
      {hint && <p className={`text-[11.5px] ${s.subText} mt-1.5 truncate`}>{hint}</p>}
    </div>
  );
};

const TrendBadge: React.FC<{ trend: string }> = ({ trend }) => {
  if (!trend) return null;
  const num = parseFloat(trend);
  const isUp = num > 0;
  const isDown = num < 0;
  const cls = isDown
    ? 'bg-coral-light text-coral-dark'
    : isUp
      ? 'bg-teal-light text-moss-dark'
      : 'bg-surface text-text-slate';
  const icon = isDown ? 'trending_down' : isUp ? 'trending_up' : '';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
      {trend}
    </span>
  );
};

function summarizeLast24h(logs: TaskLog[]) {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const last24 = logs.filter((l) => Date.parse(l.startTime) >= cutoff);
  const failed = last24.filter((l) => l.status === 'error').length;
  const avgDuration = last24.length > 0
    ? Math.round(last24.reduce((acc, l) => acc + (l.duration || 0), 0) / last24.length / 1000)
    : 0;
  return { count: last24.length, failed, avgDuration };
}

const SchedulingKpiBar: React.FC<Props> = ({ adminStats, sysStats, logs }) => {
  const { count: last24Count, failed: failed24, avgDuration } = summarizeLast24h(logs);

  const todayCount = sysStats?.todayCount ?? null;
  const yesterdayCount = sysStats?.yesterdayCount ?? 0;
  const dailyTrend = computeDailyTrend(todayCount ?? 0, yesterdayCount);

  const digestValue = adminStats?.lastDigestAt
    ? new Date(adminStats.lastDigestAt).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '尚未生成';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FeaturedCard
          label="今日聚合条目"
          icon="article"
          value={todayCount === null ? '—' : todayCount}
          accent="primary"
          trend={<TrendBadge trend={dailyTrend} />}
          hint={`昨日 ${yesterdayCount} 条 · 数据源采集汇总`}
        />
        <FeaturedCard
          label="系统状态"
          icon="monitoring"
          value={formatUptime(sysStats?.uptime)}
          accent="purple"
          hint={
            sysStats?.lastCommit
              ? `上次提交 ${formatLastCommit(sysStats.lastCommit)}${sysStats.lastCommitPlatform ? ` · 已推送至 ${sysStats.lastCommitPlatform}` : ''}`
              : '运行中 · 等待首次提交'
          }
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CompactCard
          label="待评分"
          icon="hourglass_empty"
          value={adminStats ? adminStats.raw : '—'}
          tone={adminStats && adminStats.raw > 0 ? 'yellow' : 'canvas'}
          hint="累计未评分条目"
        />
        <CompactCard
          label="24h 已评分"
          icon="task_alt"
          value={adminStats ? adminStats.processed24h : '—'}
          tone="teal"
          hint={adminStats ? `通过率 ${adminStats.passRate24h}%` : '过去 24 小时'}
        />
        <CompactCard
          label="24h 失败任务"
          icon="error"
          value={failed24}
          tone={failed24 > 0 ? 'rose' : 'canvas'}
          hint={`均耗时 ${avgDuration}s · 共 ${last24Count} 次`}
        />
        <CompactCard
          label="最近 AI 日报"
          icon="newspaper"
          value={digestValue}
          tone="canvas"
          hint="基于运行记录推断"
        />
      </div>
    </div>
  );
};

export default SchedulingKpiBar;
