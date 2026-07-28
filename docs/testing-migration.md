# 测试体系迁移路线图

本文档记录 `backend/scripts/test-*.mjs` 向 Vitest 的收口进度。根目录 [vitest.config.ts](../vitest.config.ts) 直接执行 `backend/tests/**/*.test.ts`（无需先 `build:backend`），`pnpm run test:unit` 产出 v8 覆盖率。

---

## 进度总览（2026-05）

| 状态           | 数量 | 说明                                               |
| -------------- | ---- | -------------------------------------------------- |
| ✅ 已迁 Vitest | 7    | 原纯函数 `.mjs` 已删除，见 §1.1                    |
| ⏳ 仍为 `.mjs` | 5    | 集成 / 烟雾，依赖 PostgreSQL，见 §1.2              |
| 合计           | 12   | 原 11 套 + 拆分出的 `daily-pipeline-batch-helpers` |

**禁止**再新增 `backend/scripts/test-*.mjs`；新测试一律写 `backend/tests/<feature>.test.ts`。

---

## 1. 脚本分类

### 1.1 纯函数 / 静态结构 —— ✅ 已完成

| 原 `.mjs`（已删除）                | Vitest 对应文件                                                   |
| ---------------------------------- | ----------------------------------------------------------------- |
| `test-editorial-utils.mjs`         | `editorial-utils.test.ts`、`daily-pipeline-batch-helpers.test.ts` |
| `test-workflow-input-resolver.mjs` | `workflow-input-resolver.test.ts`                                 |
| `test-workflow-agent-refs.mjs`     | `workflow-agent-refs.test.ts`                                     |
| `test-daily-coverage-utils.mjs`    | `daily-coverage-utils.test.ts`                                    |
| `test-daily-input-mode.mjs`        | `daily-input-mode.test.ts`                                        |
| `test-step-catalog.mjs`            | `step-catalog.test.ts`                                            |
| `test-build-daily-report-json.mjs` | `build-daily-report-json.test.ts`                                 |

另有早期样板：`settingsSecurity.test.ts`（设置合并 / 数组快照逻辑）。

上述用例已纳入 `pnpm run test:unit`，**不再**出现在 `test:backend-smoke` 串联中。

### 1.2 集成 / 烟雾 —— ⏳ 待迁移

| 脚本                        | 行数（约） | 测什么                                    | 依赖                                  |
| --------------------------- | ---------- | ----------------------------------------- | ------------------------------------- |
| `test-repositories.mjs`     | 234        | `LocalStore` + 各 Repository 真实读写     | `DATABASE_URL` 或 `TEST_DATABASE_URL` |
| `test-route-services.mjs`   | 183        | `*RouteService` 服务层契约                | `initRegistries` + `LocalStore`       |
| `test-api-smoke.mjs`        | 84         | `createServer()` HTTP 健康路径            | PostgreSQL + Fastify inject           |
| `test-workflow-runtime.mjs` | 795        | `WorkflowEngine` 端到端                   | PostgreSQL + ToolRegistry             |
| `test-ai-builder.mjs`       | 1675       | `AiBuilderService` plan / dry-run / apply | 大量模块 + LLM mock                   |

`pnpm run test:backend-smoke` 仍串行跑前 4 项；`pnpm run test:all` = backend-smoke + ai-builder + admin-workflow-utils + unit。

---

## 2. 后续迁移顺序（独立 PR）

1. **`repositories`** —— 在 `backend/tests/_fixtures/` 提供 `tempStore` / 测试库连接 helper。
2. **`route-services`** —— fixture 内 `initRegistries()`。
3. **`workflow-runtime`** —— 按场景拆成多个 `.test.ts`（单文件 < 300 行）。
4. **`api-smoke`** —— 与 repositories 共享 store fixture。
5. **`ai-builder`** —— 先抽 `mockLLM` fixture，再分主路径迁移。

每迁完一套，在同一 PR 中：`git rm` 原 `.mjs`、删除 `package.json` 中 `test:<name>`、更新 `test:backend-smoke` / `test:all`。

---

## 3. 单 PR 清理 checklist

- [ ] 新增 `backend/tests/<feature>.test.ts`
- [ ] 删除 `backend/scripts/test-<feature>.mjs`
- [ ] 删除 `package.json` 中对应 `test:<feature>` 脚本
- [ ] 更新 `test:backend-smoke` / `test:all` 串联
- [ ] 共享 fixture 放入 `backend/tests/_fixtures/`

---

## 4. Vitest 工程化约定

1. **不依赖 `backend/dist`**：Vitest 直接跑 `.ts`。
2. **覆盖率**：`vitest.config.ts` 已设 `coverage.thresholds`（statements 40% 等），随迁移逐步提高。
3. **慢测试**：单条 > 5s 可标 `it.slow` 或 `*.integration.test.ts`，CI 另 job。
4. **运行时间**：`test:unit` 目标本机 < 30s；集成迁完后 `test:all` 可简化为 `test:unit` + e2e 子集。

---

## 5. 与其它重构的关系

- 目录大迁移（`api → presentation` 等）与测试迁移正交，可并行排期。
- Phase B 拆大文件时优先为改动路径补 Vitest，而非新写 `.mjs`。
