/**
 * 业务枚举真相源。
 *
 * 这里集中所有「业务相关」的常量：来源类型、评分写回字段、日报相关 KV 键等。
 * 工作流步骤目录（StepCatalog）会读取这些常量来生成 configSchema 与 defaultConfig。
 *
 * 加新枚举时只改本文件，前端会通过 /api/workflows/step-types 自动同步。
 */

import { FEED_SOURCE_TYPES } from '../types/feed.js';
import type { FeedSourceType } from '../types/feed.js';

export interface BusinessEnumOption {
  value: string;
  label: string;
  description?: string;
}

/** 时间线条目的「来源类型」枚举，与 FeedSourceType 对齐。 */
export const FEED_SOURCE_TYPE_OPTIONS: BusinessEnumOption[] = [
  { value: 'official', label: '官方', description: '厂商官方博客 / 发布会 / 文档' },
  { value: 'kol', label: 'X·KOL', description: '推特等社媒上的关键意见领袖' },
  { value: 'media', label: '综合资讯', description: '科技媒体、聚合站、播客' },
  { value: 'academic', label: '学术机构', description: '论文站点、学术博客' },
  { value: 'blog', label: '大咖博客', description: '行业专家个人博客' }
];

// 编译期断言：option 列表与类型保持一致
type _AssertSourceTypes = Exclude<
  FeedSourceType,
  (typeof FEED_SOURCE_TYPE_OPTIONS)[number]['value']
>;
const _sourceTypeAssertion: _AssertSourceTypes[] = [];
void _sourceTypeAssertion;

/** 评分排序方式（store-query.orderBy）。 */
export const STORE_QUERY_ORDER_OPTIONS: BusinessEnumOption[] = [
  { value: 'fetchedDesc', label: '按抓取时间（新→旧）' },
  { value: 'publishedDesc', label: '按发布时间（新→旧）' },
  { value: 'scoreDesc', label: '按 AI 分数（高→低）' }
];

/** 单条失败处理策略（batch-iterate.onItemFailure）。 */
export const BATCH_FAILURE_OPTIONS: BusinessEnumOption[] = [
  { value: 'skip', label: '跳过继续' },
  { value: 'stop', label: '停止整批' }
];

/**
 * AI 评分写回时允许覆盖的 metadata 字段白名单。
 * 改这里就能让前端「写回条目」表单出现新的可勾选字段。
 */
export const SCORING_METADATA_KEYS = [
  'ai_score',
  'ai_summary',
  'ai_summary_short',
  'ai_recommendation',
  'ai_source_type',
  'ai_topic',
  'ai_tags',
  'ai_picked',
  'ai_related_ids'
] as const;
export type ScoringMetadataKey = (typeof SCORING_METADATA_KEYS)[number];

/** 写回的时间戳字段名（默认）。 */
export const SCORING_TIMESTAMP_FIELD = 'ai_scored_at';

/** AI 资讯日报（JSON 版）KV 键。前端按结构化数据渲染。 */
export const DAILY_REPORT_JSON_KEY_PREFIX = 'daily_report_json:';
export const DAILY_REPORT_JSON_KEY_TEMPLATE = `${DAILY_REPORT_JSON_KEY_PREFIX}\${input.date}`;
export const DAILY_REPORT_JSON_INDEX_KEY = 'daily_report_json_index';

/** 数据源采集的「全部」标识。 */
export const ADAPTER_ALL_VALUE = 'all';

export { FEED_SOURCE_TYPES };
