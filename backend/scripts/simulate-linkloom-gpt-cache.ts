#!/usr/bin/env node
/**
 * Simulate LinkLoom super_admin orchestration with per-model-call diagnostics.
 *
 * Usage (from repo root):
 *   pnpm tsx backend/scripts/simulate-linkloom-gpt-cache.ts
 *   SIM_PROVIDER_ID=ai-j6prs SIM_MODEL=mimo-v2.5-pro pnpm tsx backend/scripts/simulate-linkloom-gpt-cache.ts
 *   pnpm tsx backend/scripts/simulate-linkloom-gpt-cache.ts --both
 *   pnpm tsx backend/scripts/simulate-linkloom-gpt-cache.ts --preset=ling --long
 *   pnpm tsx backend/scripts/simulate-linkloom-gpt-cache.ts --preset=ling --turns=8
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });

import { createAIProvider } from '../src/services/AIProvider.js';
import { AgentService } from '../src/services/agents/AgentService.js';
import { LocalStoreAgentRunRegistry } from '../src/services/agents/engine/AgentRunRegistry.js';
import type { AgentMiddleware } from '../src/services/agents/engine/AgentMiddleware.js';
import type { AgentExecutionResult } from '../src/types/agent.js';
import { MCPService } from '../src/services/agents/MCPService.js';
import { SkillService } from '../src/services/agents/SkillService.js';
import { initRegistries } from '../src/registries/PluginInit.js';
import { bootstrapToolRuntime } from '../src/services/bootstrap/ToolRuntimeBootstrap.js';
import { LocalStore } from '../src/services/LocalStore.js';
import type { AIResponse } from '../src/types/index.js';
import type { SystemSettings } from '../src/types/config.js';
import {
  hashString,
  stableStringify
} from '../src/services/agents/engine/canonicalMessageSerializer.js';

const AGENT_ID = 'super_admin';

const PRESETS = {
  gpt: { providerId: 'ai-445c7', model: 'gpt-5.6-luna', label: 'GPT-5.6-Luna' },
  'gpt-cc': {
    providerId: 'ai-445c7',
    model: 'gpt-5.6-luna',
    label: 'GPT-5.6-Luna-CC',
    apiEndpoint: 'chat_completions' as const
  },
  mimo: { providerId: 'ai-j6prs', model: 'mimo-v2.5-pro', label: 'Mimo-V2.5-Pro' },
  ling: {
    providerId: 'ai-8qc2w',
    model: 'inclusionai/ling-3.0-flash:free',
    label: 'Ling-3.0-Flash'
  },
  grok: { providerId: 'ai-fgodi', model: 'grok-4.5', label: 'Grok-4.5' },
  'ds-ymeng': {
    providerId: 'ai-fo1g4',
    model: 'deepseek-v4-flash',
    label: 'DeepSeek-V4-Flash-YMeng'
  }
} as const;

interface ModelCallRow {
  turn: number;
  callIndex: number;
  prompt?: number;
  promptDelta?: number;
  cached?: number;
  cacheWrite?: number;
  uncached?: number;
  completion?: number;
  cacheStatus?: string;
  eligible?: boolean;
  cacheKeyPresent?: boolean;
  cacheKeyHash?: string;
  sessionAffinityHash?: string;
  cacheDisableReason?: string;
  contentLen: number;
  contentPreview: string;
  reasoningLen: number;
  reasoningPreview: string;
  toolCallNames: string[];
  toolCallIds: string[];
  rawPartTypes: string[];
  rawPartsSample: unknown;
  responseId?: string;
  requestPrefixHash?: string;
  requestMessageHash?: string;
  requestRoles?: string;
}

const BASE_TURNS = [
  '你好，简单打个招呼就行。',
  '帮我看看当前有哪些可用智能体？需要的话可以先 discover 再 list。',
  '那工作流呢？有哪些可以跑的工作流或相关 API？'
];

const LONG_TURNS = [
  '平台现在整体状态怎么样？可以用 platform_discover 找相关 API。',
  '最近有哪些日报或报告可以查？',
  '定时任务/调度有哪些？帮我 discover 一下相关接口。',
  '现在配置了哪些采集适配器？',
  '再问一次：当前有哪些工作流模板或实例？',
  '知识库有哪些分类或文档？有 API 的话列一下。',
  '谢谢，简单总结一下你刚才查到的要点就行。'
];

function resolveTurnScripts(argv: string[]): string[] {
  const long = argv.includes('--long');
  const turnsArg = argv.find((a) => a.startsWith('--turns='))?.split('=')[1];
  const count = turnsArg
    ? Math.max(1, Number.parseInt(turnsArg, 10) || BASE_TURNS.length)
    : long
      ? 8
      : BASE_TURNS.length;
  const pool = [...BASE_TURNS, ...LONG_TURNS];
  return pool.slice(0, Math.min(count, pool.length));
}

function cachePct(prompt?: number, cached?: number): string {
  if (!prompt || cached == null) return '0.0';
  return ((cached / prompt) * 100).toFixed(1);
}

function summarizeRequestShape(input: {
  messages: unknown[];
  systemInstruction?: string;
}): Pick<ModelCallRow, 'requestPrefixHash' | 'requestMessageHash' | 'requestRoles'> {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const stableSystem = input.systemInstruction?.replace(/\n\n当前处理日期为: [^\n]+$/, '');
  const dynamicStart = messages.findIndex((message) => {
    const content =
      message && typeof message === 'object'
        ? String((message as Record<string, unknown>).content ?? '')
        : '';
    return content.includes('<linkloom_context') || content.includes('<retrieved_knowledge>');
  });
  const stablePrefixEnd = dynamicStart >= 0 ? dynamicStart : messages.length;
  return {
    requestPrefixHash: hashString(
      stableStringify({
        systemInstruction: stableSystem,
        messages: messages.slice(0, stablePrefixEnd)
      })
    ),
    requestMessageHash: hashString(
      stableStringify({ systemInstruction: input.systemInstruction, messages })
    ),
    requestRoles: messages
      .map((message) =>
        message && typeof message === 'object'
          ? String((message as Record<string, unknown>).role ?? '?')
          : '?'
      )
      .join('→')
  };
}

function weightedCachePct(calls: ModelCallRow[]): string {
  const promptTokens = calls.reduce((sum, call) => sum + (call.prompt ?? 0), 0);
  const cachedTokens = calls.reduce((sum, call) => sum + (call.cached ?? 0), 0);
  if (promptTokens <= 0) return '0.0';
  return ((cachedTokens / promptTokens) * 100).toFixed(1);
}

function formatCacheLine(row: ModelCallRow): string {
  const pct = cachePct(row.prompt, row.cached);
  const delta =
    row.promptDelta != null ? ` Δprompt=${row.promptDelta >= 0 ? '+' : ''}${row.promptDelta}` : '';
  return (
    `CACHE #${row.callIndex} turn=${row.turn}${delta} | ` +
    `prompt=${row.prompt ?? '-'} cached=${row.cached ?? 0} (${pct}%) ` +
    `write=${row.cacheWrite ?? 0} uncached=${row.uncached ?? '-'} | ` +
    `status=${row.cacheStatus ?? '-'} eligible=${row.eligible} key=${row.cacheKeyPresent}` +
    (row.cacheKeyHash ? ` keyHash=${row.cacheKeyHash}` : '') +
    (row.cacheDisableReason ? ` reason=${row.cacheDisableReason}` : '')
  );
}

function printTurnCacheSummary(turn: number, calls: ModelCallRow[]): void {
  if (calls.length === 0) return;
  const cached = calls.map((c) => c.cached ?? 0);
  const prompts = calls.map((c) => c.prompt ?? 0);
  const pcts = calls.map((c) => cachePct(c.prompt, c.cached));
  const zeros = cached.filter((x) => x === 0).length;
  const hits = calls.filter((c) => c.cacheStatus === 'hit').length;
  const writes = calls.filter((c) => c.cacheStatus === 'write').length;
  console.log(
    `  ⟡ Turn ${turn} cache: calls=${calls.length} hits=${hits} writes=${writes} zeros=${zeros} ` +
      `weightedHit=${weightedCachePct(calls)}% | pct=[${pcts.join('→')}] | ` +
      `cached=[${cached.join('→')}]`
  );
}

interface TurnResult {
  turn: number;
  userInput: string;
  stopReason?: string;
  contentPreview: string;
  toolCallsFromResult: string[];
  modelCalls: ModelCallRow[];
}

function summarizeResponse(result: unknown): Omit<ModelCallRow, 'turn' | 'callIndex'> {
  const r = result as AIResponse | undefined;
  const usage = r?.usage;
  const pc = usage?.prompt_cache;
  const content = r?.content ?? '';
  const reasoning = r?.reasoning ?? '';
  const toolCalls = r?.tool_calls ?? [];
  const rawParts = Array.isArray(r?.raw_parts) ? r.raw_parts : [];

  return {
    prompt: usage?.prompt_tokens,
    cached: pc?.cachedInputTokens ?? 0,
    cacheWrite: pc?.cacheWriteInputTokens ?? 0,
    uncached: pc?.uncachedInputTokens,
    completion: usage?.completion_tokens,
    cacheStatus: pc?.cacheStatus,
    eligible: pc?.eligible,
    cacheKeyPresent: pc?.cacheKeyPresent,
    cacheKeyHash: pc?.cacheKeyHash,
    sessionAffinityHash: pc?.sessionAffinityHash,
    cacheDisableReason: pc?.cacheDisableReason,
    contentLen: content.length,
    contentPreview: content.replace(/\s+/g, ' ').slice(0, 160),
    reasoningLen: reasoning.length,
    reasoningPreview: reasoning.replace(/\s+/g, ' ').slice(0, 160),
    toolCallNames: toolCalls.map((t) => t.name),
    toolCallIds: toolCalls.map((t) => t.id),
    rawPartTypes: rawParts.map((p) =>
      p && typeof p === 'object' && 'type' in p ? String((p as { type: unknown }).type) : typeof p
    ),
    rawPartsSample: rawParts.slice(0, 8).map((p) => {
      if (!p || typeof p !== 'object') return p;
      const part = p as Record<string, unknown>;
      const out: Record<string, unknown> = { type: part.type };
      if (typeof part.text === 'string') out.text = part.text.slice(0, 120);
      if (typeof part.summary === 'string') out.summary = part.summary.slice(0, 120);
      if (part.name) out.name = part.name;
      if (part.arguments) out.arguments = String(part.arguments).slice(0, 120);
      if (part.id) out.id = part.id;
      if (part.call_id) out.call_id = part.call_id;
      return out;
    }),
    responseId: r?.response_id
  };
}

function buildDiagnosticsMiddleware(
  turnLabel: number,
  bucket: ModelCallRow[],
  callCounter: { n: number },
  lastPrompt: { value?: number }
): AgentMiddleware {
  return {
    name: `diag-${turnLabel}`,
    afterModelCall: (ctx) => {
      callCounter.n += 1;
      const summary = summarizeResponse(ctx.result);
      const requestShape = summarizeRequestShape({
        messages: ctx.messages,
        systemInstruction: ctx.systemInstruction
      });
      const promptDelta =
        summary.prompt != null && lastPrompt.value != null
          ? summary.prompt - lastPrompt.value
          : undefined;
      if (summary.prompt != null) lastPrompt.value = summary.prompt;

      const row: ModelCallRow = {
        turn: turnLabel,
        callIndex: callCounter.n,
        promptDelta,
        ...requestShape,
        ...summary
      };
      bucket.push(row);

      console.log(`  ${formatCacheLine(row)}`);
      console.log(
        `    completion=${summary.completion ?? '-'} content=${summary.contentLen}ch ` +
          `reasoning=${summary.reasoningLen}ch tools=[${summary.toolCallNames.join(',') || '-'}]`
      );
      console.log(
        `    requestPrefix=${requestShape.requestPrefixHash} request=${requestShape.requestMessageHash} ` +
          `roles=${requestShape.requestRoles}`
      );
      if (summary.contentPreview) {
        console.log(`    contentPreview: ${summary.contentPreview.slice(0, 120)}`);
      }
    }
  };
}

async function runSimulation(input: {
  providerId: string;
  model: string;
  label: string;
  apiEndpoint?: 'chat_completions' | 'responses' | 'messages' | 'auto';
  turns: string[];
  store: LocalStore;
  settings: SystemSettings;
}): Promise<{
  label: string;
  providerId: string;
  model: string;
  sessionId: string;
  turnResults: TurnResult[];
  allModelCalls: ModelCallRow[];
}> {
  const baseConfig = input.settings.AI_PROVIDERS?.find((p) => p.id === input.providerId);
  if (!baseConfig) {
    throw new Error(`Provider ${input.providerId} not found`);
  }
  const providerConfig = input.apiEndpoint
    ? { ...baseConfig, apiEndpoint: input.apiEndpoint }
    : baseConfig;

  // AgentService resolves provider from settings — patch in-memory for endpoint override.
  const simSettings: SystemSettings = input.apiEndpoint
    ? {
        ...input.settings,
        AI_PROVIDERS: input.settings.AI_PROVIDERS.map((p) =>
          p.id === input.providerId ? { ...p, apiEndpoint: input.apiEndpoint } : p
        )
      }
    : input.settings;

  console.log(`\n${'='.repeat(72)}`);
  console.log(`=== ${input.label} (${input.providerId} / ${input.model}) ===`);
  console.log(`endpoint=${providerConfig.apiEndpoint} apiUrl=${providerConfig.apiUrl}`);

  const fallbackProvider = createAIProvider(providerConfig);
  const skillService = new SkillService();
  await skillService.init();
  const mcpService = new MCPService();
  const runRegistry = new LocalStoreAgentRunRegistry(input.store);
  const agentService = new AgentService(
    input.store,
    fallbackProvider,
    skillService,
    mcpService,
    undefined,
    runRegistry,
    simSettings
  );

  const sessionId = `sim_${input.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
  const date = new Date().toISOString().slice(0, 10);
  const threadId = `thread_${sessionId}`;
  const callCounter = { n: 0 };
  const lastPrompt = { value: undefined as number | undefined };
  const allModelCalls: ModelCallRow[] = [];
  const turnResults: TurnResult[] = [];

  const turns = input.turns;

  console.log(`sessionId=${sessionId} turns=${turns.length}\n`);

  for (let i = 0; i < turns.length; i += 1) {
    const userInput = turns[i];
    const turnModelCalls: ModelCallRow[] = [];
    const callsBefore = callCounter.n;

    console.log(
      `--- Turn ${i + 1}: ${userInput.slice(0, 64)}${userInput.length > 64 ? '…' : ''} ---`
    );

    const result: AgentExecutionResult = await agentService.runAgent(AGENT_ID, userInput, date, {
      silent: true,
      sessionId,
      threadId,
      middleware: [buildDiagnosticsMiddleware(i + 1, turnModelCalls, callCounter, lastPrompt)],
      metadata: {
        agentConsole: {
          provider: input.providerId,
          model: input.model
        }
      }
    });

    allModelCalls.push(...turnModelCalls);
    const preview = (result.content || '').replace(/\s+/g, ' ').slice(0, 120);
    const toolCallsFromResult = (result.toolCalls ?? []).map((t) => t.name);

    console.log(
      `  → run stopReason=${result.stopReason} content="${preview || '(empty)'}" ` +
        `runTools=[${toolCallsFromResult.join(',') || '-'}] modelCallsThisTurn=${callCounter.n - callsBefore}`
    );

    // Trace rounds (multi-step within one user turn)
    const traceRounds = result.trace?.rounds ?? [];
    if (traceRounds.length > 0) {
      for (const round of traceRounds) {
        const roundTools = (round.toolCalls ?? []).map((t) => t.name).join(',') || '-';
        const roundContent = (round.content || '').replace(/\s+/g, ' ').slice(0, 80);
        console.log(
          `    trace round ${round.round}: tools=[${roundTools}] content="${roundContent || '(empty)'}"`
        );
      }
    }

    turnResults.push({
      turn: i + 1,
      userInput,
      stopReason: result.stopReason,
      contentPreview: preview,
      toolCallsFromResult,
      modelCalls: turnModelCalls
    });

    printTurnCacheSummary(i + 1, turnModelCalls);

    console.log('');
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log('--- CACHE SUMMARY (all calls) ---');
  console.table(
    allModelCalls.map((r) => ({
      turn: r.turn,
      call: r.callIndex,
      prompt: r.prompt,
      dPrompt: r.promptDelta,
      cached: r.cached,
      write: r.cacheWrite,
      uncached: r.uncached,
      pct: r.prompt ? `${(((r.cached ?? 0) / r.prompt) * 100).toFixed(1)}%` : '-',
      status: r.cacheStatus,
      tools: r.toolCallNames.join(',') || '-',
      reason: (r.cacheDisableReason || '').slice(0, 40)
    }))
  );

  const cached = allModelCalls.map((r) => r.cached ?? 0);
  const prompts = allModelCalls.map((r) => r.prompt ?? 0);
  const subsequentCalls = allModelCalls.slice(1);
  const subsequentZeros = subsequentCalls.filter((call) => (call.cached ?? 0) === 0).length;
  console.log(
    `prompts: ${prompts.join(' → ')} | cached: ${cached.join(' → ')} | ` +
      `zeros: ${cached.filter((x) => x === 0).length}/${cached.length} | ` +
      `coldStart=${allModelCalls[0]?.cached ?? 0} | ` +
      `subsequentZeros=${subsequentZeros}/${subsequentCalls.length} | ` +
      `subsequentWeightedHit=${weightedCachePct(subsequentCalls)}%`
  );

  const outPath = `/tmp/linkloom-sim-${input.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sessionId}.json`;
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        label: input.label,
        providerId: input.providerId,
        model: input.model,
        sessionId,
        turnResults,
        allModelCalls
      },
      null,
      2
    )
  );
  console.log(`wrote ${outPath}`);

  return {
    label: input.label,
    providerId: input.providerId,
    model: input.model,
    sessionId,
    turnResults,
    allModelCalls
  };
}

async function main() {
  const argv = process.argv;
  const turnScripts = resolveTurnScripts(argv);
  const runBoth = argv.includes('--both');
  const runGptCompare = argv.includes('--gpt-compare');
  const presetArg = argv.find((a) => a.startsWith('--preset='))?.split('=')[1];

  await initRegistries();
  bootstrapToolRuntime();

  const store = new LocalStore();
  await store.init();
  const settings = (await store.get('system_settings')) as SystemSettings | null;
  if (!settings?.AI_PROVIDERS?.length) {
    throw new Error('system_settings missing AI_PROVIDERS');
  }

  const jobs: Array<{
    providerId: string;
    model: string;
    label: string;
    apiEndpoint?: 'chat_completions' | 'responses' | 'messages' | 'auto';
  }> = [];

  if (runGptCompare) {
    jobs.push(PRESETS.gpt, PRESETS['gpt-cc']);
  } else if (runBoth) {
    jobs.push(PRESETS.gpt, PRESETS.mimo);
  } else if (presetArg === 'mimo') {
    jobs.push(PRESETS.mimo);
  } else if (presetArg === 'ling') {
    jobs.push(PRESETS.ling);
  } else if (presetArg === 'grok') {
    jobs.push(PRESETS.grok);
  } else if (presetArg === 'ds-ymeng' || presetArg === 'deepseek') {
    jobs.push(PRESETS['ds-ymeng']);
  } else if (presetArg === 'gpt-cc') {
    jobs.push(PRESETS['gpt-cc']);
  } else if (presetArg === 'gpt') {
    jobs.push(PRESETS.gpt);
  } else if (process.env.SIM_PROVIDER_ID || process.env.SIM_MODEL) {
    jobs.push({
      providerId: process.env.SIM_PROVIDER_ID?.trim() || PRESETS.gpt.providerId,
      model: process.env.SIM_MODEL?.trim() || PRESETS.gpt.model,
      label: process.env.SIM_LABEL?.trim() || 'custom'
    });
  } else {
    jobs.push(PRESETS.gpt, PRESETS.mimo);
  }

  const summaries = [];
  for (const job of jobs) {
    summaries.push(await runSimulation({ ...job, turns: turnScripts, store, settings }));
  }

  if (summaries.length > 1) {
    console.log(`\n${'='.repeat(72)}`);
    console.log('=== SIDE-BY-SIDE ===');
    console.table(
      summaries.map((s) => ({
        model: s.label,
        calls: s.allModelCalls.length,
        prompts: s.allModelCalls.map((r) => r.prompt).join('→'),
        cached: s.allModelCalls.map((r) => r.cached).join('→'),
        emptyTurns: s.turnResults.filter((t) => t.stopReason === 'empty_response').length,
        toolTurns: s.turnResults.filter((t) => t.toolCallsFromResult.length > 0).length
      }))
    );
  }

  await store.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
