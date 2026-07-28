import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ADMIN_HIGH_RISK_INTERVENTION_API_NAMES,
  ADMIN_PARAM_LABELS,
  ADMIN_REGUIDE_REJECT_REASON,
  ADMIN_WRITE_INTERVENTION_API_NAMES,
  formatAdminArgValue,
  isHighRiskAdminIntervention,
} from './adminInterventionConfig';
import { BUILTIN_INTERVENTION_APIS } from './registryMeta';

describe('AdminActionConfirmIntervention config', () => {
  it('formatAdminArgValue renders booleans and primitives', () => {
    expect(formatAdminArgValue('每日采集')).toBe('每日采集');
    expect(formatAdminArgValue('0 6 * * *')).toBe('0 6 * * *');
    expect(formatAdminArgValue(true)).toBe('是');
    expect(formatAdminArgValue(false)).toBe('否');
    expect(formatAdminArgValue(['local_site'])).toBe('local_site');
  });

  it('labels include cron and schedule fields', () => {
    expect(ADMIN_PARAM_LABELS.name).toBe('任务名称');
    expect(ADMIN_PARAM_LABELS.cronExpr).toBe('cron 表达式');
    expect(ADMIN_PARAM_LABELS.scheduleId).toBe('任务 id');
    expect(ADMIN_PARAM_LABELS.adapterName).toBe('适配器名称');
    expect(ADMIN_PARAM_LABELS.asOfDate).toBe('基准日期');
    expect(ADMIN_PARAM_LABELS.historyId).toBe('发布历史 id');
    expect(ADMIN_PARAM_LABELS.platform).toBe('发布平台');
    expect(ADMIN_PARAM_LABELS.rangeFrom).toBe('范围起始');
  });

  it('shows 高危 for deleteCron and publishReport', () => {
    expect(isHighRiskAdminIntervention('deleteCron')).toBe(true);
    expect(isHighRiskAdminIntervention('publishReport')).toBe(true);
    expect(isHighRiskAdminIntervention('deleteNews')).toBe(true);
    expect(isHighRiskAdminIntervention('clearAdapterData')).toBe(true);
  });

  it('does not mark createCron or syncAdapter as high risk', () => {
    expect(isHighRiskAdminIntervention('createCron')).toBe(false);
    expect(isHighRiskAdminIntervention('syncAdapter')).toBe(false);
    expect(isHighRiskAdminIntervention('refreshDigestContext')).toBe(false);
    expect(isHighRiskAdminIntervention('republishReport')).toBe(false);
    expect(ADMIN_HIGH_RISK_INTERVENTION_API_NAMES.has('createCron')).toBe(false);
    expect(ADMIN_HIGH_RISK_INTERVENTION_API_NAMES.has('syncAdapter')).toBe(false);
    expect(ADMIN_HIGH_RISK_INTERVENTION_API_NAMES.has('refreshDigestContext')).toBe(false);
  });

  it('marks deleteCommitHistory as high risk', () => {
    expect(isHighRiskAdminIntervention('deleteCommitHistory')).toBe(true);
    expect(ADMIN_HIGH_RISK_INTERVENTION_API_NAMES.has('deleteCommitHistory')).toBe(true);
  });

  it('marks phase 4 high-risk writes and saveAgent as not high risk', () => {
    expect(isHighRiskAdminIntervention('deleteAgent')).toBe(true);
    expect(isHighRiskAdminIntervention('deleteKbDocument')).toBe(true);
    expect(isHighRiskAdminIntervention('updateSettings')).toBe(true);
    expect(isHighRiskAdminIntervention('saveAgent')).toBe(false);
    expect(isHighRiskAdminIntervention('saveWorkflow')).toBe(false);
    expect(isHighRiskAdminIntervention('batchResetScoring')).toBe(false);
  });

  it('labels include phase 4 param fields', () => {
    expect(ADMIN_PARAM_LABELS.agent).toBe('智能体');
    expect(ADMIN_PARAM_LABELS.workflow).toBe('工作流');
    expect(ADMIN_PARAM_LABELS.templateId).toBe('模板 id');
    expect(ADMIN_PARAM_LABELS.patch).toBe('修改字段');
    expect(ADMIN_PARAM_LABELS.providerId).toBe('提供商 id');
    expect(ADMIN_PARAM_LABELS.newsIds).toBe('新闻 id 列表');
    expect(ADMIN_PARAM_LABELS.dryRun).toBe('试运行');
    expect(ADMIN_PARAM_LABELS.documentId).toBe('文档 id');
    expect(ADMIN_PARAM_LABELS.apiKeyName).toBe('API Key 名称');
  });

  it('registry meta maps 27 admin write apiNames', () => {
    expect(BUILTIN_INTERVENTION_APIS['linkloom-admin']).toEqual(ADMIN_WRITE_INTERVENTION_API_NAMES);
    expect(ADMIN_WRITE_INTERVENTION_API_NAMES).toHaveLength(27);
  });

  it('registry meta does not include query apiNames', () => {
    const adminApis = BUILTIN_INTERVENTION_APIS['linkloom-admin'] ?? [];
    expect(adminApis).not.toContain('listSchedules');
    expect(adminApis).not.toContain('getNewsItem');
  });

  it('registry maps updateSettings to SettingsPatchIntervention', () => {
    const registryPath = join(
      dirname(fileURLToPath(import.meta.url)),
      'registry.ts',
    );
    const source = readFileSync(registryPath, 'utf8');
    expect(source).toContain("apiName === 'updateSettings' ? SettingsPatchIntervention");
    expect(source).toContain("from './builtins/SettingsPatchIntervention'");
  });

  it('ADMIN_REGUIDE_REJECT_REASON prompts agent to re-guide', () => {
    expect(ADMIN_REGUIDE_REJECT_REASON).toContain('重新引导');
  });
});
