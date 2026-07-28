/** 运营中心指标与术语的 inline 释义（用于 title / 辅助说明） */

export const OPS_METRIC_HINTS = {
  activeRuns: '当前排队中、运行中、已暂停或取消中的智能体任务数量',
  successRate: '近 7 日所有运行中成功结束的比例（全局统计）',
  failureRate: '近 7 日运行失败次数占总运行次数的比例',
  pauseRate: '因等待人工审批或外部输入而暂停的运行占比',
  permissionInterceptRate: '运行中因工具权限未获批而被拦截暂停的比例',
  p90DurationMs: '90% 的运行在此耗时以内完成（比平均值更能反映长尾）',
  averageDurationMs: '近 7 日所有已完成运行的平均耗时',
  totalRuns: '近 7 日统计窗口内的运行总次数',
  passRate: '评估用例中通过质量门禁（gate）的比例',
  mrr: 'Mean Reciprocal Rank：首个正确结果排名倒数的均值，越高越好',
  hitRate: '检索结果中至少命中一条相关证据的比例',
  recallAtK: '前 K 条结果中召回相关文档的比例',
  citationAccuracy: '生成答案中引用与证据匹配正确的比例',
  evalRun: '使用固定测试集对索引版本做自动化质量评估的一次运行',
  dryRun: '只预估影响范围，不实际写入索引或发布内容'
} as const;
