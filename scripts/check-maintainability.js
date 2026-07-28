#!/usr/bin/env node
// 可维护性闸门：自动扫描 + HARD_LIMITS 双模式。
//
// 上一版只硬编码 6 个文件，其中 admin/src/pages/{Agents,Settings,Generation}.tsx 已退化为 1 行 re-export，
// 真正巨型文件如 AgentsPage.tsx / AiBuilderPanel.tsx / AiBuilderService.ts / WorkflowEngine.ts 都没被卡住。
//
// 行为：
// 1. WARN_THRESHOLD：扫 backend/src / admin/src / web/src 下所有源码文件，超过通用阈值的报 warning（不失败 CI）。
// 2. HARD_LIMITS：显式声明本次冻结的最大行数，超过则 CI 失败。
//    Phase B 各 PR 合入后逐项调小，防止重构期间出现新的巨型文件。
//
// 用法：
//   pnpm run check:maintainability         # 默认模式：HARD_LIMITS 超限失败
//   pnpm run check:maintainability -- --update-baseline   # 输出当前所有 > WARN_THRESHOLD 的文件，用于人工锁基线

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SCAN_DIRS = ['backend/src', 'admin/src', 'web/src'];
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const IGNORE_DIR_NAMES = new Set(['node_modules', 'dist', 'public', '__tests__', '.next']);

/** 通用 warning 阈值。超过则在终端输出 warning，但不让 CI 失败。 */
const WARN_THRESHOLD = 500;

/**
 * 显式上限。Phase B 完成后逐步调小：
 *   B1 完成 → ServiceContext / LocalStore 应缩小
 *   B2 完成 → AiBuilderService ≤ 500
 *   B3 完成 → WorkflowEngine ≤ 400
 *   B5 完成 → AgentsPage ≤ 300
 *   B6 完成 → SettingsPage ≤ 250
 *   B7 完成 → AiBuilderPanel ≤ 500
 *
 * 当前冻结值反映 2026-05-26 baseline（plan §A3）。
 */
const HARD_LIMITS = {
  // 后端 wiring / 编排（已经较小）
  'backend/src/api/server.ts': 220,
  'backend/src/services/initServices.ts': 140,
  'backend/src/services/LocalStore.ts': 420,

  // 后端待拆（Phase B2 / B3）—— 每个 PR 合入后逐步调小
  'backend/src/services/aiBuilder/AiBuilderService.ts': 500, // Phase B2 门面
  'backend/src/services/aiBuilder/AiBuilderPlanService.ts': 1300,
  'backend/src/services/aiBuilder/AiBuilderChatService.ts': 800,
  'backend/src/services/aiBuilder/AiBuilderDryRunService.ts': 550,
  // Phase B3 完成：拆分为 batch/* + runtime/WorkflowStepDispatcher.ts，门面已 ≤ 350 行
  'backend/src/services/agents/WorkflowEngine.ts': 350,

  // 前端待拆（Phase B5 / B6 / B7）—— B5：抽出 SkillsTab / AgentsTab / ToolsTab / WorkflowsTab
  // TODO（B5 后续）：抽 useAgentsPageState + workflow graph 预览，目标 ≤ 300 行
  'admin/src/pages/agents/AgentsPage.tsx': 1406,
  // B7 完成：sessionStorage + useAiBuilderSession + useAiBuilderActions + AiBuilderInputFooter
  'admin/src/pages/agents/aiBuilder/AiBuilderPanel.tsx': 500,
  // B6 完成：sectionsConfig + SettingsField + fields/* + useSettingsFieldHandlers
  'admin/src/pages/settings/SettingsPage.tsx': 250
};

function collectFiles(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [rel];

  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORE_DIR_NAMES.has(entry.name)) continue;
    out.push(...collectFiles(path.join(rel, entry.name)));
  }
  return out;
}

function lineCount(rel) {
  const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (content.length === 0) return 0;
  return content.split(/\r?\n/).length;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const updateMode = args.has('--update-baseline');

  const warnings = [];
  const hardFailures = [];
  let scanned = 0;

  for (const dir of SCAN_DIRS) {
    for (const rel of collectFiles(dir)) {
      const ext = path.extname(rel);
      if (!TEXT_EXTENSIONS.has(ext)) continue;
      scanned++;
      const lines = lineCount(rel);
      if (lines > WARN_THRESHOLD) warnings.push({ rel, lines });

      const limit = HARD_LIMITS[rel];
      if (limit !== undefined && lines > limit) {
        hardFailures.push({ rel, lines, limit });
      }
    }
  }

  for (const rel of Object.keys(HARD_LIMITS)) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      hardFailures.push({
        rel,
        lines: 0,
        limit: HARD_LIMITS[rel],
        reason: 'missing-baseline-target'
      });
    }
  }

  warnings.sort((a, b) => b.lines - a.lines);

  if (updateMode) {
    console.log('=== Files over WARN_THRESHOLD (current baseline) ===');
    for (const w of warnings) console.log(`  ${w.rel}: ${w.lines}`);
    console.log(`\nScanned ${scanned} files; ${warnings.length} over ${WARN_THRESHOLD} lines.`);
    process.exit(0);
  }

  if (warnings.length > 0) {
    console.log(`Maintainability warnings (> ${WARN_THRESHOLD} lines, not blocking):`);
    for (const w of warnings) {
      const limit = HARD_LIMITS[w.rel];
      const tag = limit !== undefined ? ` [HARD_LIMIT=${limit}]` : '';
      console.log(`  ${w.rel}: ${w.lines}${tag}`);
    }
  }

  if (hardFailures.length > 0) {
    console.error('\nMaintainability HARD_LIMITS exceeded (CI failure):');
    for (const f of hardFailures) {
      if (f.reason === 'missing-baseline-target') {
        console.error(`  ${f.rel}: file missing (HARD_LIMITS entry should be removed)`);
      } else {
        console.error(`  ${f.rel}: ${f.lines} > ${f.limit}`);
      }
    }
    console.error(
      '\nHint: 修复方式（按优先级）：\n' +
        '  1. 把文件拆小到 HARD_LIMIT 以下（推荐，参见 plan Phase B）。\n' +
        '  2. 若是合理增长，先在 PR 中把 scripts/check-maintainability.js 的对应阈值显式调整，并附原因。'
    );
    process.exit(1);
  }

  console.log(`Maintainability check passed. Scanned ${scanned} files.`);
}

main();
