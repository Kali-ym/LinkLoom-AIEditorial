import {
  ADAPTER_ALL_VALUE,
  DAILY_REPORT_JSON_INDEX_KEY,
  DAILY_REPORT_JSON_KEY_TEMPLATE,
  FEED_SOURCE_TYPE_OPTIONS,
  SCORING_METADATA_KEYS,
  SCORING_TIMESTAMP_FIELD
} from '../../config/businessEnums.js';
import type { AiBuildBusinessEnums, AiBuildDomainCatalog } from '../../types/aiBuilder.js';
import type { AiBuilderDomainCatalogProvider } from '../aiBuilder/AiBuilderDomainCatalogProvider.js';

export class LinkLoomDomainCatalogProvider implements AiBuilderDomainCatalogProvider {
  buildDomainCatalog(): AiBuildDomainCatalog {
    return {
      domains: [
        {
          id: 'linkloom-content-pipeline',
          label: '内容管线',
          description: 'LinkLoom 当前业务域：采集、筛选、结构化分析、写回 metadata、产物落 KV。',
          enums: {
            feedSourceTypes: FEED_SOURCE_TYPE_OPTIONS,
            scoringMetadataKeys: [...SCORING_METADATA_KEYS],
            scoringTimestampField: SCORING_TIMESTAMP_FIELD,
            adapterAllValue: ADAPTER_ALL_VALUE
          },
          keyTemplates: {
            dailyReportJsonKeyTemplate: DAILY_REPORT_JSON_KEY_TEMPLATE,
            dailyReportJsonIndexKey: DAILY_REPORT_JSON_INDEX_KEY
          },
          pipelinePatterns: [
            {
              id: 'collect-query-analyze-persist-publish',
              label: '采集查询分析写回发布',
              description: '先采集或查询候选数据，再批量分析，最后写回 metadata 并把产物落到 KV。',
              steps: [
                'adapter',
                'store-query',
                'transform',
                'batch-iterate',
                'store-write',
                'kv-write'
              ],
              configGuidance: [
                '筛选条件、排序和 limit 放到 store-query.configOverrides。',
                '逐条分析使用 batch-iterate.child 指向 agent、workflow 或可执行 pipeline 子步骤。',
                '写回字段白名单放到 store-write.configOverrides.allowedKeys。',
                '发布类产物使用 kv-write.configOverrides.key / indexKey / indexValue。'
              ]
            }
          ]
        }
      ]
    };
  }

  buildLegacyBusinessEnums(): AiBuildBusinessEnums {
    return {
      feedSourceTypes: FEED_SOURCE_TYPE_OPTIONS,
      scoringMetadataKeys: [...SCORING_METADATA_KEYS],
      scoringTimestampField: SCORING_TIMESTAMP_FIELD,
      dailyReportJsonKeyTemplate: DAILY_REPORT_JSON_KEY_TEMPLATE,
      dailyReportJsonIndexKey: DAILY_REPORT_JSON_INDEX_KEY,
      adapterAllValue: ADAPTER_ALL_VALUE
    };
  }
}
