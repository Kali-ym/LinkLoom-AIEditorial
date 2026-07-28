import type {
  DailyQualityGateInput,
  DailyQualityGatePolicy,
  DailyQualityGateResult,
  DailyQualityIssue,
  DailyQualityIssueCode,
  DailyQualitySeverity
} from '../../types/dailyQualityGate.js';

const DEFAULT_POLICY: DailyQualityGatePolicy = {
  enabled: false,
  minSources: 2,
  blockOnWarnings: false
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTitle(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, ' ')
    .trim();
}

function issue(input: {
  code: DailyQualityIssueCode;
  severity: DailyQualitySeverity;
  path: string;
  message: string;
  value?: unknown;
}): DailyQualityIssue {
  return input;
}

function mergePolicy(policy?: Partial<DailyQualityGatePolicy>): DailyQualityGatePolicy {
  return {
    ...DEFAULT_POLICY,
    ...policy,
    enabled: policy?.enabled === true,
    minSources:
      typeof policy?.minSources === 'number' && Number.isFinite(policy.minSources)
        ? Math.max(0, Math.floor(policy.minSources))
        : DEFAULT_POLICY.minSources,
    blockOnWarnings: policy?.blockOnWarnings === true
  };
}

function collectSourceKeys(item: Record<string, unknown>): string[] {
  const metaKeys: string[] = [];
  for (const meta of asArray(item.sourceMetas)) {
    const obj = asRecord(meta);
    if (!obj) continue;
    const key = [obj.kind, obj.name, obj.displayText].map(text).join('|');
    if (key.replace(/\|/g, '').trim()) metaKeys.push(key);
  }

  const sourceMeta = asRecord(item.sourceMeta);
  if (sourceMeta) {
    const key = [sourceMeta.kind, sourceMeta.name, sourceMeta.displayText].map(text).join('|');
    if (key.replace(/\|/g, '').trim()) metaKeys.push(key);
  }

  if (metaKeys.length > 0) return metaKeys;

  const sourceKeys: string[] = [];
  for (const source of asArray(item.sourceItems)) {
    const obj = asRecord(source);
    if (!obj) continue;
    const key = [obj.source, obj.url, obj.author].map(text).join('|');
    if (key.replace(/\|/g, '').trim()) sourceKeys.push(key);
  }
  return sourceKeys;
}

function validateRequiredFields(report: Record<string, unknown>): DailyQualityIssue[] {
  const issues: DailyQualityIssue[] = [];
  for (const key of ['schemaVersion', 'date', 'title', 'description', 'headlines', 'sections']) {
    const value = report[key];
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      issues.push(
        issue({
          code: 'missing_required_field',
          severity: 'error',
          path: `$.${key}`,
          message: `日报缺少必填字段 ${key}`,
          value
        })
      );
    }
  }
  return issues;
}

function validateSections(report: Record<string, unknown>): DailyQualityIssue[] {
  const issues: DailyQualityIssue[] = [];
  const sections = asArray(report.sections);
  if (sections.length === 0) {
    issues.push(
      issue({
        code: 'empty_sections',
        severity: 'error',
        path: '$.sections',
        message: '日报正文 sections 为空'
      })
    );
    return issues;
  }

  const titlePaths = new Map<string, string>();
  for (const [sectionIndex, rawSection] of sections.entries()) {
    const section = asRecord(rawSection);
    const sectionPath = `$.sections[${sectionIndex}]`;
    if (!section) {
      issues.push(
        issue({
          code: 'empty_section_items',
          severity: 'error',
          path: sectionPath,
          message: 'section 结构无效'
        })
      );
      continue;
    }

    const items = asArray(section.items);
    if (items.length === 0) {
      issues.push(
        issue({
          code: 'empty_section_items',
          severity: 'warning',
          path: `${sectionPath}.items`,
          message: 'section 没有正文条目'
        })
      );
    }

    for (const [itemIndex, rawItem] of items.entries()) {
      const item = asRecord(rawItem);
      const itemPath = `${sectionPath}.items[${itemIndex}]`;
      if (!item) continue;
      const itemTitle = normalizeTitle(item.title);
      if (itemTitle) {
        const previousPath = titlePaths.get(itemTitle);
        if (previousPath) {
          issues.push(
            issue({
              code: 'duplicate_title',
              severity: 'warning',
              path: `${itemPath}.title`,
              message: `正文标题重复，首次出现于 ${previousPath}`,
              value: item.title
            })
          );
        } else {
          titlePaths.set(itemTitle, `${itemPath}.title`);
        }
      }

      if (!text(item.bodyMd)) {
        issues.push(
          issue({
            code: 'empty_item_body',
            severity: 'error',
            path: `${itemPath}.bodyMd`,
            message: '正文条目缺少 bodyMd'
          })
        );
      }
      if (!text(item.url)) {
        issues.push(
          issue({
            code: 'missing_item_url',
            severity: 'warning',
            path: `${itemPath}.url`,
            message: '正文条目缺少原文 URL'
          })
        );
      }
    }
  }

  return issues;
}

function validateHeadlines(report: Record<string, unknown>): DailyQualityIssue[] {
  const issues: DailyQualityIssue[] = [];
  const sections = asArray(report.sections);
  const itemTopicIds = new Set<string>();
  for (const rawSection of sections) {
    const section = asRecord(rawSection);
    if (!section) continue;
    for (const rawItem of asArray(section.items)) {
      const item = asRecord(rawItem);
      const topicId = text(item?.topicId);
      if (topicId) itemTopicIds.add(topicId);
    }
  }

  for (const [index, rawHeadline] of asArray(report.headlines).entries()) {
    const headline = asRecord(rawHeadline);
    const topicId = text(headline?.topicId);
    if (topicId && !itemTopicIds.has(topicId)) {
      issues.push(
        issue({
          code: 'headline_without_item',
          severity: 'error',
          path: `$.headlines[${index}].topicId`,
          message: '要闻引用了正文中不存在的 topicId',
          value: topicId
        })
      );
    }
  }

  return issues;
}

function validateSources(
  report: Record<string, unknown>,
  policy: DailyQualityGatePolicy
): DailyQualityIssue[] {
  const sources = new Set<string>();
  for (const rawSection of asArray(report.sections)) {
    const section = asRecord(rawSection);
    if (!section) continue;
    for (const rawItem of asArray(section.items)) {
      const item = asRecord(rawItem);
      if (!item) continue;
      for (const key of collectSourceKeys(item)) sources.add(key.toLowerCase());
    }
  }

  if (sources.size < policy.minSources) {
    return [
      issue({
        code: 'insufficient_sources',
        severity: 'warning',
        path: '$.sections[*].items[*].sourceItems',
        message: `日报信源数不足，当前 ${sources.size}，要求至少 ${policy.minSources}`,
        value: sources.size
      })
    ];
  }
  return [];
}

export class DailyQualityGateService {
  evaluate(input: DailyQualityGateInput): DailyQualityGateResult {
    const policy = mergePolicy(input.policy);
    const checkedAt = new Date().toISOString();

    if (!policy.enabled) {
      return {
        enabled: false,
        approved: true,
        requiresApproval: false,
        issueCount: 0,
        errorCount: 0,
        warningCount: 0,
        issues: [],
        checkedAt
      };
    }

    const report = asRecord(input.report);
    const issues: DailyQualityIssue[] = [];
    if (!report) {
      issues.push(
        issue({
          code: 'missing_required_field',
          severity: 'error',
          path: '$',
          message: '日报产物不是有效对象',
          value: input.report
        })
      );
    } else {
      issues.push(...validateRequiredFields(report));
      issues.push(...validateSections(report));
      issues.push(...validateHeadlines(report));
      issues.push(...validateSources(report, policy));
    }

    const errorCount = issues.filter((item) => item.severity === 'error').length;
    const warningCount = issues.filter((item) => item.severity === 'warning').length;
    const requiresApproval = errorCount > 0 || (policy.blockOnWarnings && warningCount > 0);

    return {
      enabled: true,
      approved: !requiresApproval,
      requiresApproval,
      issueCount: issues.length,
      errorCount,
      warningCount,
      issues,
      checkedAt
    };
  }
}