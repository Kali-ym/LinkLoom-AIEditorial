export const MEMORY_READ_AGENT_ID = 'memory_read_assistant';
export const MEMORY_WRITE_AGENT_ID = 'memory_write_assistant';

export const FEED_SCORING_AGENT_ID = 'feed_scoring_agent';

/** 单条素材评分子工作流（被 pipeline 在 batch-iterate 内引用）。 */
export const FEED_SCORING_WORKFLOW_ID = 'feed_scoring_workflow';

/** 完整的「批量评分」管线（store-query → batch-iterate → store-write）。 */
export const FEED_SCORING_PIPELINE_WORKFLOW_ID = 'feed_scoring_pipeline_workflow';
