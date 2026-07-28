import { describe, expect, it } from 'vitest';
import { DailyQualityGateService } from '../src/services/editorial/DailyQualityGateService.js';

function buildValidReport() {
  return {
    schemaVersion: 2,
    date: '2026-06-06',
    title: 'AI资讯日报 2026/6/6',
    description: '今日 AI 资讯摘要。',
    headlines: [{ rank: 1, topicId: 't1', title: 'OpenAI 发布新模型' }],
    sections: [
      {
        id: '模型与权重',
        title: '模型与权重',
        items: [
          {
            topicId: 't1',
            title: 'OpenAI 发布新模型',
            url: 'https://example.com/openai',
            bodyMd: 'OpenAI 发布新模型。',
            sourceItems: [{ source: 'OpenAI 官网', url: 'https://example.com/openai' }],
            sourceMetas: [{ kind: '官方', name: 'OpenAI', displayText: '官方：OpenAI' }]
          },
          {
            topicId: 't2',
            title: 'GitHub Copilot 更新',
            url: 'https://example.com/github',
            bodyMd: 'GitHub Copilot 发布更新。',
            sourceItems: [{ source: 'GitHub Blog', url: 'https://example.com/github' }],
            sourceMetas: [{ kind: '官方', name: 'GitHub Blog', displayText: '官方：GitHub Blog' }]
          }
        ]
      }
    ]
  };
}

describe('DailyQualityGateService', () => {
  it('keeps default daily generation unblocked when gate is disabled', () => {
    const service = new DailyQualityGateService();

    const result = service.evaluate({ report: null });

    expect(result).toMatchObject({
      enabled: false,
      approved: true,
      requiresApproval: false,
      issueCount: 0
    });
  });

  it('approves valid report when explicit gate is enabled', () => {
    const service = new DailyQualityGateService();

    const result = service.evaluate({
      report: buildValidReport(),
      policy: { enabled: true, minSources: 2 }
    });

    expect(result.enabled).toBe(true);
    expect(result.approved).toBe(true);
    expect(result.requiresApproval).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it('requires approval for deterministic report errors', () => {
    const service = new DailyQualityGateService();
    const report = buildValidReport();
    report.headlines = [{ rank: 1, topicId: 'missing-topic', title: '不存在的要闻' }];
    report.sections[0].items[0].bodyMd = '';
    report.sections[0].items[1].title = report.sections[0].items[0].title;

    const result = service.evaluate({
      report,
      policy: { enabled: true, minSources: 2 }
    });

    expect(result.approved).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.errorCount).toBeGreaterThanOrEqual(2);
    expect(result.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(['empty_item_body', 'headline_without_item', 'duplicate_title'])
    );
  });

  it('can escalate warnings when configured', () => {
    const service = new DailyQualityGateService();
    const report = buildValidReport();
    report.sections[0].items = [report.sections[0].items[0]];

    const result = service.evaluate({
      report,
      policy: { enabled: true, minSources: 2, blockOnWarnings: true }
    });

    expect(result.warningCount).toBeGreaterThanOrEqual(1);
    expect(result.issues.map((item) => item.code)).toContain('insufficient_sources');
    expect(result.requiresApproval).toBe(true);
  });
});