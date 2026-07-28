import type { RagModeId } from '../retrieve/retrieveModeUtils.js';

export type FieldMeta = {
  field: string;
  label: string;
  hint: string;
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
};

export const RETRIEVAL_SWITCHES: FieldMeta[] = [
  {
    field: 'hybridEnabled',
    label: '混合检索',
    hint: '启用向量召回；需配置向量模型服务。'
  },
  {
    field: 'embedOnIngest',
    label: '入库自动索引',
    hint: '文档写入后自动入队 embedding job。'
  },
  {
    field: 'rerankEnabled',
    label: '结果精排',
    hint: '对候选结果重排序；需精排模型服务。'
  },
  {
    field: 'mmrEnabled',
    label: 'MMR 去冗余',
    hint: '在最终证据选择前平衡相关性和多样性。'
  },
  {
    field: 'queryRewriteEnabled',
    label: '查询规划',
    hint: '检索前由智能体预选分类与文档范围。'
  },
  {
    field: 'jsonbVectorFallbackEnabled',
    label: 'JSONB 向量回退',
    hint: 'pgvector 不可用时使用 JSONB 备用索引。'
  }
];

export const QUALITY_FIELDS: FieldMeta[] = [
  {
    field: 'retrievalTopK',
    label: '召回 Top-K',
    hint: '初筛候选数量；越大覆盖越广、延迟越高。',
    placeholder: '20',
    min: 1,
    max: 100
  },
  {
    field: 'rerankTopK',
    label: '精排 Top-K',
    hint: 'Rerank 后保留条数。',
    placeholder: '5',
    min: 1,
    max: 50
  },
  {
    field: 'minVectorCoverageForHybrid',
    label: '混合检索覆盖率门槛',
    hint: '低于该比例时降级到全文检索；0.8 表示 80%。',
    placeholder: '0.8',
    min: 0,
    max: 1
  },
  {
    field: 'mmrLambda',
    label: 'MMR 相关性权重',
    hint: '越高越偏相关性，越低越偏多样性。',
    placeholder: '0.7',
    min: 0,
    max: 1
  }
];

export const SCORE_FIELDS: FieldMeta[] = [
  {
    field: 'ftsWeight',
    label: 'FTS 权重',
    hint: '越高越偏向关键词字面匹配。',
    placeholder: '0.5',
    min: 0,
    max: 1
  },
  {
    field: 'vectorWeight',
    label: '向量权重',
    hint: '越高越偏向语义相似度。',
    placeholder: '0.5',
    min: 0,
    max: 1
  }
];

export const JOB_FIELDS: FieldMeta[] = [
  {
    field: 'embeddingBatchSize',
    label: 'Job 批大小',
    hint: 'run-once 每批处理的分块数。',
    placeholder: '16',
    min: 1,
    max: 100
  },
  {
    field: 'embeddingMaxAttempts',
    label: '失败重试次数',
    hint: '单任务最大重试次数。',
    placeholder: '3',
    min: 1,
    max: 10
  }
];

export const PLANNER_FIELDS: FieldMeta[] = [
  {
    field: 'plannerMaxCategories',
    label: 'Planner 分类上限',
    hint: 'Query Planner 最多预选分类数。',
    placeholder: '3',
    min: 1,
    max: 20
  },
  {
    field: 'plannerMaxDocuments',
    label: 'Planner 文档上限',
    hint: 'Query Planner 最多预选文档数。',
    placeholder: '8',
    min: 1,
    max: 50
  }
];

export const CHUNK_FIXED_FIELDS: FieldMeta[] = [
  {
    field: 'chunkSize',
    label: '块大小（字符）',
    hint: '固定长度切分的目标字符数。',
    placeholder: '3000',
    min: 200
  },
  {
    field: 'chunkOverlap',
    label: '重叠（字符）',
    hint: '相邻块重叠字符数，保留上下文。',
    placeholder: '400',
    min: 0
  }
];

export const CHUNK_STRUCTURE_FIELDS: FieldMeta[] = [
  {
    field: 'semanticMaxChunkSize',
    label: '单块上限（字符）',
    hint: '结构分割时单块最大字符数。',
    placeholder: '3000',
    min: 200
  },
  {
    field: 'semanticMinChunkSize',
    label: '小块合并阈值',
    hint: '过短段落合并到此阈值。',
    placeholder: '200',
    min: 0
  }
];

export const CHUNK_EMBEDDING_FIELDS: FieldMeta[] = [
  ...CHUNK_STRUCTURE_FIELDS,
  {
    field: 'semanticBreakpointPercentile',
    label: '语义断点百分位',
    hint: '越高越不易在语义边界处切分。',
    placeholder: '85',
    min: 0,
    max: 100,
    suffix: '%'
  }
];

export const MODE_OPTIONS: Array<{
  id: Exclude<RagModeId, 'custom'>;
  label: string;
  hint: string;
}> = [
  { id: 'fts', label: '全文检索', hint: '关键词匹配，无需向量模型' },
  { id: 'hybrid', label: '混合检索', hint: '向量 + 全文混合召回' },
  { id: 'hybrid-rerank', label: '混合检索 + 精排', hint: '混合召回后再精排' }
];
