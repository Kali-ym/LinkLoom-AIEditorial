import React from 'react';
import type { AgentRunMetrics, PendingPermissionItem } from '../../../services/agentService';
import { formatUptime } from '../../scheduling/utils/format';

export interface OpsKpiBarData {
  metrics: AgentRunMetrics | null;
  pending: PendingPermissionItem[];
  alertCount: number;
  uptime?: number;
}

interface Props {
  data: OpsKpiBarData;
  onNavigateInbox: () => void;
  onNavigateRag?: () => void;
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
  onClick?: () => void;
}

interface CompactCardProps {
  label: string;
  icon: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: React.ReactNode;
  onClick?: () => void;
  badge?: React.ReactNode;
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

const TONE_STYLES: Record<Tone, { bg: string; text: string; subText: string; hover: string; pulse?: string }> = {
  yellow: {
    bg: 'bg-surface-yellow',
    text: 'text-yellow-dark',
    subText: 'text-yellow-dark/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5 cursor-pointer',
  },
  lavender: {
    bg: 'bg-surface-lavender',
    text: 'text-ink-deep',
    subText: 'text-ink-deep/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5 cursor-pointer',
  },
  teal: {
    bg: 'bg-teal-light',
    text: 'text-moss-dark',
    subText: 'text-moss-dark/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5 cursor-pointer',
  },
  coral: {
    bg: 'bg-coral-light',
    text: 'text-coral-dark',
    subText: 'text-coral-dark/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5 cursor-pointer',
  },
  rose: {
    bg: 'bg-rose-light',
    text: 'text-ink',
    subText: 'text-ink/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5 cursor-pointer',
  },
  ink: {
    bg: 'bg-ink dark:bg-white',
    text: 'text-white dark:text-ink',
    subText: 'text-white/70 dark:text-ink/70',
    hover: 'hover:shadow-card hover:-translate-y-0.5 cursor-pointer',
  },
  canvas: {
    bg: 'bg-canvas dark:bg-surface-dark border border-hairline-soft dark:border-white/5',
    text: 'text-text-ink dark:text-white',
    subText: 'text-text-slate dark:text-text-secondary',
    hover: 'hover:shadow-subtle hover:-translate-y-0.5 hover:border-hairline-strong dark:hover:border-white/10 cursor-pointer',
  },
};

const FeaturedCard: React.FC<FeaturedCardProps> = ({
  label,
  icon,
  value,
  accent = 'primary',
  hint,
  trend,
  onClick,
}) => {
  const a = GRADIENT_ACCENTS[accent];
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-4xl border border-hairline-soft dark:border-white/5 bg-canvas dark:bg-surface-dark p-7 min-h-[148px] group transition-all duration-200 ease-out ${
        onClick ? `hover:shadow-card hover:-translate-y-0.5 ${a.hoverBorder}` : ''
      }`}
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
          <p className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${a.subText}`}>{label}</p>
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

const CompactCard: React.FC<CompactCardProps> = ({
  label,
  icon,
  value,
  tone = 'canvas',
  hint,
  onClick,
  badge,
}) => {
  const s = TONE_STYLES[tone];
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl ${s.bg} px-5 py-4 min-h-[96px] flex flex-col justify-center transition-all duration-200 ease-out ${s.hover}`}
    >
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${s.subText} mb-1.5`}>
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
        <span className="truncate">{label}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </div>
      <p className={`text-[22px] leading-none font-medium tabular-nums truncate ${s.text}`}>
        {value}
      </p>
      {hint && <p className={`text-[11.5px] ${s.subText} mt-1.5 truncate`}>{hint}</p>}
    </div>
  );
};

function formatDuration(ms?: number): string {
  if (ms == null || ms === 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

const OpsKpiBar: React.FC<Props> = ({ data, onNavigateInbox, onNavigateRag }) => {
  const { metrics, pending, alertCount, uptime } = data;

  const todayRuns = metrics?.totalRuns ?? 0;
  const successRate = metrics?.successRate ?? 0;
  const activeRuns = metrics?.activeRuns ?? 0;
  const pendingCount = pending.length;
  const failedRate = metrics?.failureRate ?? 0;
  const avgDuration = metrics?.averageDurationMs;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FeaturedCard
          label="今日运行"
          icon="play_circle"
          value={todayRuns}
          accent="primary"
          hint={`成功率 ${successRate}% · 失败率 ${failedRate}%`}
        />
        <FeaturedCard
          label="系统状态"
          icon="monitoring"
          value={alertCount > 0 ? '需介入' : '运行正常'}
          accent={alertCount > 0 ? 'purple' : 'primary'}
          hint={uptime ? `运行 ${formatUptime(uptime)}` : activeRuns > 0 ? `${activeRuns} 个任务进行中` : '暂无活跃任务'}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CompactCard
          label="活跃任务"
          icon="hourglass_empty"
          value={activeRuns}
          tone={activeRuns > 0 ? 'lavender' : 'canvas'}
          hint="排队或执行中"
        />
        <CompactCard
          label="待审批"
          icon="verified_user"
          value={pendingCount}
          tone={pendingCount > 0 ? 'yellow' : 'canvas'}
          hint="权限与人工确认"
          onClick={onNavigateInbox}
          badge={
            pendingCount > 0 ? (
              <span className="rounded-full bg-amber-200 px-1.5 text-[10px] font-bold text-amber-900 dark:bg-amber-400/30 dark:text-amber-200">
                {pendingCount}
              </span>
            ) : undefined
          }
        />
        <CompactCard
          label="知识检索"
          icon="manage_search"
          value="RAG"
          tone="canvas"
          hint="配置向量检索与索引"
          onClick={onNavigateRag}
        />
        <CompactCard
          label="平均耗时"
          icon="speed"
          value={formatDuration(avgDuration)}
          tone="canvas"
          hint="最近 7 日均值"
        />
      </div>
    </div>
  );
};

export default OpsKpiBar;
