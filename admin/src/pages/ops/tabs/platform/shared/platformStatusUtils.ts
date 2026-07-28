import type { GovernanceStatus, RegressionRunRecord, SourceQualityStatus } from '../../../../../services/agentService';

export type PlatformSection = 'governance' | 'quality' | 'regression';

const VALID_SECTIONS: PlatformSection[] = ['governance', 'quality', 'regression'];

export function parsePlatformSection(value: string | null): PlatformSection {
  if (value && VALID_SECTIONS.includes(value as PlatformSection)) {
    return value as PlatformSection;
  }
  return 'governance';
}

export type PlatformChipTone = 'ok' | 'warn' | 'unknown';

export type PlatformChipState = {
  tone: PlatformChipTone;
  label: string;
  hint?: string;
  href?: string;
};

export function buildGovernanceChip(status: GovernanceStatus | null, errored: boolean): PlatformChipState {
  if (errored || !status) return { tone: 'unknown', label: '治理 未知' };
  if (status.pendingPermissions > 0) {
    return {
      tone: 'warn',
      label: `治理 ${status.pendingPermissions} 待审批`,
      hint: '前往待办处理审批',
      href: '/ops?tab=inbox'
    };
  }
  return { tone: 'ok', label: '治理 正常' };
}

export function buildQualityChip(status: SourceQualityStatus | null, errored: boolean): PlatformChipState {
  if (errored || !status) return { tone: 'unknown', label: '质量 未知' };
  if (!status.enabled) {
    return {
      tone: 'warn',
      label: '质量 未启用',
      hint: '配置来源质量门禁',
      href: '/ops?tab=platform&section=quality'
    };
  }
  return { tone: 'ok', label: '质量 已启用' };
}

export function buildRegressionChip(runs: RegressionRunRecord[] | null, errored: boolean): PlatformChipState {
  if (errored || !runs) return { tone: 'unknown', label: '回归 未知' };
  const failed = runs.filter((run) => !run.passed);
  if (failed.length > 0) {
    return {
      tone: 'warn',
      label: `回归 ${failed.length} 失败`,
      hint: '查看回归详情',
      href: '/ops?tab=platform&section=regression'
    };
  }
  return { tone: 'ok', label: '回归 正常' };
}

export function summarizeRegressionRuns(runs: RegressionRunRecord[]): { passed: number; failed: number; total: number } {
  const passed = runs.filter((run) => run.passed).length;
  const failed = runs.length - passed;
  return { passed, failed, total: runs.length };
}

/** 最近一批 run（同一分钟内 createdAt 聚类）的 pass/fail；无 runs 时返回 null */
export function summarizeLatestBatch(runs: RegressionRunRecord[]): { passed: number; total: number } | null {
  if (runs.length === 0) return null;
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latest = new Date(sorted[0].createdAt).getTime();
  const batch = sorted.filter(
    (run) => Math.abs(new Date(run.createdAt).getTime() - latest) < 60_000
  );
  const passed = batch.filter((run) => run.passed).length;
  return { passed, total: batch.length };
}
