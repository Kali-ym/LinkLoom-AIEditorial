import type { BaseTool } from '../../../base/BaseTool.js';
import { queryTools } from './queryTools.js';
import { cronTools } from './cronTools.js';
import { workflowTools } from './workflowTools.js';
import { newsReportTools } from './newsReportTools.js';
import { schedulingTools } from './schedulingTools.js';
import { selectionTools } from './selectionTools.js';
import { generationTools } from './generationTools.js';
import { opsTools } from './opsTools.js';
import { historyTools } from './historyTools.js';
import { agentTools } from './agentTools.js';
import { knowledgeTools } from './knowledgeTools.js';
import { settingsTools } from './settingsTools.js';
import { batchTools } from './batchTools.js';
import { hotSnapshotTools } from './hotSnapshotTools.js';

/** 超级管理员 agent 的 admin 操作工具集。 */
export const ADMIN_TOOLS: BaseTool[] = [
  ...queryTools,
  ...cronTools,
  ...workflowTools,
  ...newsReportTools,
  ...schedulingTools,
  ...selectionTools,
  ...generationTools,
  ...opsTools,
  ...historyTools,
  ...agentTools,
  ...knowledgeTools,
  ...settingsTools,
  ...batchTools,
  ...hotSnapshotTools,
];

export const ADMIN_TOOL_IDS: string[] = ADMIN_TOOLS.map((t) => t.id);

export {
  queryTools,
  cronTools,
  workflowTools,
  newsReportTools,
  schedulingTools,
  selectionTools,
  generationTools,
  opsTools,
  historyTools,
  agentTools,
  knowledgeTools,
  settingsTools,
  batchTools,
  hotSnapshotTools,
};
