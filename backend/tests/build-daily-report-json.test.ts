import { describe, expect, it } from 'vitest';
import { BuildDailyReportJsonTool } from '../src/plugins/builtin/tools/BuildDailyReportJsonTool.js';

const tool = new BuildDailyReportJsonTool();

const brief = {
  count: 3,
  items: [
    {
      index: 1,
      topic_id: 't1',
      title: 'OpenAI 发布新模型',
      url: 'https://example.com/a',
      section: '模型与权重',
      importance_rank: 1,
      headline_candidate: true,
      source_items: [
        { index: 1, source: 'OpenAI 官网', source_meta: { kind: '官方', name: 'OpenAI' } }
      ],
      body_md:
        'OpenAI 今日发布了新模型 GPT-X，[详情(AI资讯)](https://example.com/a)。\n\n来源：[https://example.com/a](https://example.com/a)',
      ai_score: 95,
      reason: '直接 AI 产品发布'
    },
    {
      index: 2,
      topic_id: 't2',
      title: 'GitHub 上线 AI Copilot 工具',
      url: 'https://example.com/b',
      section: '产品与商业',
      importance_rank: 2,
      headline_candidate: false,
      source_items: [
        { index: 2, source: 'GitHub Blog', source_meta: { kind: '官方', name: 'GitHub Blog' } }
      ],
      body_md:
        'GitHub 宣布上线 Copilot 工具升级。\n\n来源：[https://example.com/b](https://example.com/b)',
      ai_score: 80
    },
    {
      index: 3,
      topic_id: 't3',
      title: '安全研究：模型对齐新方法',
      url: 'https://example.com/c',
      section: '研究与评测',
      importance_rank: 3,
      headline_candidate: true,
      source_items: [
        {
          index: 3,
          source: 'Apple ML Research',
          source_meta: { kind: '学术机构', name: 'Apple ML Research', format: 'RSS' }
        }
      ],
      body_md:
        '研究者提出了新的模型对齐方法。\n\n来源：[https://example.com/c](https://example.com/c)',
      ai_score: 88
    }
  ]
};

const digest = {
  headlines: [
    { rank: 1, topicId: 't1', title: 'OpenAI 发布新模型' },
    { rank: 2, topicId: 't3', title: '安全研究：模型对齐新方法' }
  ],
  metaDescription: '今日 AI 资讯：模型发布、开发工具与研究安全的最新进展。'
};

const meta = {
  yaml_block: '---\ntitle: AI日报\n---',
  top_quotes_markdown: '> [访问网页版↗️](/) | By Kali',
  footer_markdown: '---\n\n## 多渠道\n| 渠道 | 链接 |\n| --- | --- |\n| RSS | / |'
};

describe('BuildDailyReportJsonTool', () => {
  it('builds full report with correct structure', async () => {
    const result = await tool.handler({
      brief,
      digest,
      meta,
      editorialPlan: { topics: brief.items.length },
      date: '2026-05-23',
      titleTemplate: 'AI资讯日报 {yyyy}/{m}/{d}',
      linkTitleTemplate: '{mm}-{dd} AI资讯',
      descriptionDefault: '默认描述',
      headlineMaxTopics: 5,
      coverageNamespace: 'ai-daily'
    });

    expect(result.success).toBe(true);
    const r = result.report;
    expect(r.schemaVersion).toBe(2);
    expect(r.date).toBe('2026-05-23');
    expect(r.title).toBe('AI资讯日报 2026/5/23');
    expect(r.linkTitle).toBe('05-23 AI资讯');
    expect(r.description).toBe('今日 AI 资讯：模型发布、开发工具与研究安全的最新进展。');
    expect(r.yamlBlock).toBe('---\ntitle: AI日报\n---');
    expect(r.topQuotesMd).toContain('访问网页版');
    expect(r.topQuotesMd).not.toContain('每日一X');
    expect(r.vol).toBe('2026.05.23');
    expect(r.chineseDate).toBe('二〇二六年五月二十三日 星期六');
    expect(r.brandName).toBe('LINKLOOM DAILY');
    expect(r.subtitle).toBe('DAILY · 每早八时');
    expect(r.stats.totalStories).toBe(3);
    expect(r.stats.newModels).toBe(1);
    expect(r.stats.primaryReports).toBeGreaterThanOrEqual(2);

    // headlines: digest 2 条 + 自动补 1 条到 cap=5
    expect(r.headlines).toHaveLength(3);
    expect(r.headlines[0].rank).toBe(1);
    expect(r.headlines[0].topicId).toBe('t1');
    expect(r.headlines[0].title).toBe('OpenAI 发布新模型');
    expect(r.headlines[0].url).toBe('https://example.com/a');
    expect(r.headlines[1].topicId).toBe('t3');
    expect(r.headlines[2].topicId).toBe('t2');

    // sections 按 section 分组
    expect(r.sections).toHaveLength(3);
    expect(r.sections.map((s: any) => s.id)).toEqual([
      '模型与权重',
      '产品与商业',
      '研究与评测'
    ]);
    expect(r.sections[0].subtitle).toBe('Model & Weights');
    expect(r.sections[1].subtitle).toBe('Product & Biz');
    expect(r.sections[2].subtitle).toBe('Research & Eval');
    expect(r.sections[0].items).toHaveLength(1);
    expect(r.sections[0].items[0].topicId).toBe('t1');
    expect(r.sections[0].items[0].bodyMd).toContain('OpenAI');
    expect(r.sections[0].items[0].headlineCandidate).toBe(true);
    expect(r.sections[0].items[0].sourceMeta).toBeTruthy();
    expect(r.sections[0].items[0].sourceMeta.displayText).toBe('官方：OpenAI');

    // kv 字段
    expect(result.kvKey).toBe('daily_report_json:2026-05-23');
    expect(result.kvIndexKey).toBe('daily_report_json_index');
    expect(result.kvIndexValue).toBe('2026-05-23');
    expect(typeof result.content).toBe('string');
    expect(JSON.parse(result.content).date).toBe('2026-05-23');
  });

  it('auto-fills headlines when digest has none', async () => {
    const fallback = await tool.handler({
      brief,
      digest: { headlines: [], metaDescription: '' },
      meta,
      date: '2026-05-23',
      titleTemplate: 'AI资讯日报 {yyyy}/{m}/{d}',
      linkTitleTemplate: '{mm}-{dd} AI资讯',
      descriptionDefault: '默认',
      headlineMaxTopics: 2
    });

    expect(fallback.report.headlines).toHaveLength(2);
    // 优先 headline_candidate=true，再按 rank
    expect(fallback.report.headlines[0].topicId).toBe('t1');
    expect(fallback.report.headlines[1].topicId).toBe('t3');
    expect(fallback.report.description).toBe('默认');
  });

  it('accepts JSON string inputs', async () => {
    const fromJson = await tool.handler({
      brief: JSON.stringify(brief),
      digest: JSON.stringify(digest),
      meta: JSON.stringify(meta),
      date: '2026-05-23',
      titleTemplate: 'AI {yyyy}',
      linkTitleTemplate: '{mm}-{dd}',
      headlineMaxTopics: 5
    });

    expect(fromJson.report.headlines).toHaveLength(3);
    expect(fromJson.report.sections).toHaveLength(3);
  });
});
