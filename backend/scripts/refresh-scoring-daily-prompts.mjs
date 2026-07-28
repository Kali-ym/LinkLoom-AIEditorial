/**
 * Refresh scoring + daily agent prompts, and strip daily-one-x wiring from live agents/workflows.
 * Usage (repo root, after build:backend):
 *   NODE_ENV=production node backend/scripts/refresh-scoring-daily-prompts.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
loadEnv({ path: path.join(root, '.env') });

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.chdir(root);

const { LocalStore } = await import('../dist/services/LocalStore.js');
const { PromptService } = await import('../dist/services/PromptService.js');

/** agentId → promptRef */
const AGENT_PROMPT_MAP = {
  feed_scoring_agent: 'feed_scoring',
  ai_daily_json_summary_ingest_router: 'daily_ingest_router',
  ai_daily_json_summary_editorial_plan: 'daily_editorial_plan',
  ai_daily_json_summary_brief_batch: 'daily_brief_batch',
  ai_daily_json_summary_digest_json: 'daily_digest_body_json',
  ai_daily_json_summary_meta_footer: 'daily_meta_footer',
  ai_daily_json_raw_ingest_router: 'daily_ingest_router',
  ai_daily_json_raw_editorial_plan: 'daily_editorial_plan',
  ai_daily_json_raw_brief_batch: 'daily_brief_batch',
  ai_daily_json_raw_digest_json: 'daily_digest_body_json',
  ai_daily_json_raw_meta_footer: 'daily_meta_footer',
  ai_daily_json_raw_material_brief: 'daily_material_brief'
};

function stripDailyOneXFromValue(value) {
  if (Array.isArray(value)) return value.map(stripDailyOneXFromValue);
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, val] of Object.entries(value)) {
      if (
        key === 'dailyOneXTopic' ||
        key === 'daily_one_x_topic' ||
        key === 'dailyOneX'
      ) {
        continue;
      }
      next[key] = stripDailyOneXFromValue(val);
    }
    if (Array.isArray(next.skillIds)) {
      next.skillIds = next.skillIds.filter((id) => id !== 'daily-one-x');
    }
    return next;
  }
  return value;
}

const store = new LocalStore();
await store.init();
const prompts = PromptService.getInstance();
await prompts.loadTemplates();

const updated = [];
const skipped = [];

for (const [agentId, promptRef] of Object.entries(AGENT_PROMPT_MAP)) {
  const agent = await store.getAgent(agentId);
  if (!agent) {
    skipped.push(`${agentId} (missing)`);
    continue;
  }
  const systemPrompt = prompts.getPrompt(promptRef);
  if (!systemPrompt || !systemPrompt.trim()) {
    skipped.push(`${agentId} (empty prompt ${promptRef})`);
    continue;
  }
  const cleaned = stripDailyOneXFromValue({ ...agent, systemPrompt });
  if (Array.isArray(cleaned.skillIds)) {
    cleaned.skillIds = cleaned.skillIds.filter((id) => id !== 'daily-one-x');
  } else {
    cleaned.skillIds = [];
  }
  await store.saveAgent(cleaned);
  updated.push(`${agentId} ← ${promptRef} (${systemPrompt.length} chars)`);
}

const workflows = await store.listWorkflows();
for (const wf of workflows) {
  const before = JSON.stringify(wf);
  const cleaned = stripDailyOneXFromValue(wf);
  if (JSON.stringify(cleaned) !== before) {
    await store.saveWorkflow(cleaned);
    updated.push(`workflow:${wf.id} stripped daily-one-x fields`);
  }
}

await store.close();
console.log('updated:');
for (const line of updated) console.log('  ', line);
console.log('skipped:');
for (const line of skipped) console.log('  ', line);
