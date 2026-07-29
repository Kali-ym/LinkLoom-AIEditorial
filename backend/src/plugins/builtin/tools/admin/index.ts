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
import { PlatformDiscoverTool } from './PlatformDiscoverTool.js';
import { PlatformInvokeTool } from './PlatformInvokeTool.js';

const platformDiscover = new PlatformDiscoverTool();
const platformInvoke = new PlatformInvokeTool();

/** LLM-facing platform primitives. */
export const ADMIN_PLATFORM_TOOLS: BaseTool[] = [platformDiscover, platformInvoke];

/**
 * High-semantics SOP adapters kept as dedicated tools (HITL cards / playbook).
 * Other CRUD stays in ADMIN_LEGACY_TOOLS for platform_invoke dispatch + /api/tools/:id/run.
 */
export const ADMIN_SOP_TOOL_IDS = [
  'rebuild_hot_snapshot',
  'trigger_scoring',
  'generate_daily_report',
  'decide_workflow_step',
  'update_news_score',
  'run_workflow',
  'publish_report',
  'create_cron',
] as const;

export const ADMIN_LEGACY_TOOLS: BaseTool[] = [
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

const sopIdSet = new Set<string>(ADMIN_SOP_TOOL_IDS);

export const ADMIN_SOP_TOOLS: BaseTool[] = ADMIN_LEGACY_TOOLS.filter((t) => sopIdSet.has(t.id));

/** Dispatch-only CRUD (registered for platform_invoke /api/tools/:id/run, not LLM-bound). */
export const ADMIN_DISPATCH_TOOL_IDS: readonly string[] = ADMIN_LEGACY_TOOLS.filter(
  (t) => !sopIdSet.has(t.id),
).map((t) => t.id);

/** All admin tools registered in ToolRegistry (platform + legacy handlers). */
export const ADMIN_TOOLS: BaseTool[] = [...ADMIN_PLATFORM_TOOLS, ...ADMIN_LEGACY_TOOLS];

/** Tool ids exposed to super_admin LLM binding (not the full CRUD surface). */
export const ADMIN_TOOL_IDS: string[] = [
  ...ADMIN_PLATFORM_TOOLS.map((t) => t.id),
  ...ADMIN_SOP_TOOL_IDS,
];

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
