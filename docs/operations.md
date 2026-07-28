# 运维索引

## 文档入口

| 主题     | 路径                                                |
| -------- | --------------------------------------------------- |
| 项目结构 | [`STRUCTURE.md`](STRUCTURE.md)                      |
| 环境变量 | [`env.md`](env.md)（常用项见根目录 `.env.example` 与 [`config/README.md`](../config/README.md)） |
| 部署     | [`deployment.md`](deployment.md)                    |
| 部署资产 | [`../deploy/README.md`](../deploy/README.md)        |
| 备份恢复 | [`backup-restore.md`](backup-restore.md)            |
| 安全边界 | [`security.md`](security.md)                        |
| 故障处理 | [`runbook.md`](runbook.md)                          |
| 升级回滚 | [`upgrade.md`](upgrade.md)                          |
| 产品边界 | [`product-boundary.md`](product-boundary.md)        |
| 测试迁移 | [`testing-migration.md`](testing-migration.md)      |

## 核心原则

- 只运行**一个**后端写实例；公开前端只读。
- 结构化数据以 **PostgreSQL** 为准；`data/` 下主要为 skills、模板类文件资产（`memory/`、`knowledge/` 目录若存在则一并备份，业务主数据已在库内）。
- 生产反代只暴露 backend `PORT`（默认 `3000`），勿对外暴露 Next `NEXT_PORT`。

## 本地开发检查清单

1. Node ≥ 24.15，pnpm 11.5.1（`corepack enable && corepack prepare pnpm@11.5.1 --activate`）。
2. PostgreSQL 16+ 已启动，`.env` 中 `DATABASE_URL` 可连；生产 Docker 默认使用 `pgvector/pgvector:pg16`，非 Docker 部署需在库内启用 `vector` 扩展。
3. `pnpm install` → `pnpm run dev:all` 或分端 `dev:backend` / `dev:admin` / `dev:web`。
4. 提交前：`pnpm run typecheck:all`、`pnpm run test:unit`；有 DB 时再加 `pnpm run test:backend-smoke`。
5. 合并前：`pnpm run ci`。

## Agent 运行模式

管理端 Agent 支持两种运行模式：

- `classic`：默认模式。沿用现有多轮工具调用兼容行为；旧 Agent 未配置 `runtime` 时按该模式处理。
- `react`：显式 ReAct 模式。模型可在多轮中自主调用已绑定工具，系统记录每轮 action、observation、停止原因和 trace。

可配置项：

| 字段                              | 默认值                 | 说明                                      |
| --------------------------------- | ---------------------- | ----------------------------------------- |
| `runtime.mode`                    | `classic`              | `classic` 或 `react`                      |
| `runtime.maxRounds`               | `5`                    | 单次 Agent run 最多工具推理轮次           |
| `runtime.returnTrace`             | `true`                 | 是否在 Agent run 结果中返回结构化执行轨迹 |
| `runtime.toolErrorStrategy`       | `observe-and-continue` | 工具失败后作为观察继续，或直接停止        |
| `runtime.maxRepeatedToolErrors`   | `2`                    | 同一工具、同一失败签名最多允许重复次数    |
| `runtime.stopOnRepeatedToolError` | `true`                 | 是否在重复工具失败时提前停止              |

工具调用链路：

```text
Provider tool_calls
  -> ToolCallNormalizer
  -> ToolArgumentValidator
  -> ToolRegistry / MCPService
  -> Observation
  -> Trace / SSE events
```

入口关系：

- 非流式 `/api/agents/:id/run` 返回 `content`、`stopReason`、`trace`。
- 流式 `/api/agents/:id/run-stream` 和显式 `stream=true` 的 `/api/agents/:id/run` 通过 SSE 返回 `round_start`、`tool_start`、`tool_result` / `tool_error`、`trace_observation`、`final_content`、`final_trace` 等事件。
- Workflow Agent step 仍只消费 Agent 的最终 `content`，不把 trace 写入 step output；但普通 step、batch step 和自纠错重试都会经过同一个 `AgentService.runAgent` 入口。
- 内部调用可通过 `noTools` / `noSkills` 禁用工具或技能；禁用工具时不会绑定本地工具、MCP 工具，也不会因技能自动加入 `execute_command`。

工具协议边界：

- 查询类工具支持 `query`、`q`、`keyword`、`keywords`、`text`、`question`、`content`、`search`、`term` 等别名。
- JSON 字符串参数会先解析为对象；查询类字符串参数可归一化为 `{ "query": "..." }`。
- 缺少 required 参数或类型不匹配时，会在工具边界返回可观测错误，不进入底层检索/业务服务。
- 同一工具重复出现同类参数错误时会提前停止，避免刷满 `maxRounds`。

回归验证：

```bash
pnpm --dir "/home/openclaw/NewsDaily/RSSPLUS/LinkLoom" --config.engine-strict=false exec vitest run backend/tests/tool-protocol.test.ts backend/tests/query-tools.test.ts backend/tests/react-runtime.test.ts backend/tests/provider-tool-calls.test.ts backend/tests/agent-run-service.test.ts backend/tests/agent-stream.test.ts backend/tests/workflow-agent-runtime.test.ts
pnpm --dir "/home/openclaw/NewsDaily/RSSPLUS/LinkLoom" --config.engine-strict=false exec tsc -p tsconfig.json --noEmit
pnpm --dir "/home/openclaw/NewsDaily/RSSPLUS/LinkLoom/admin" --config.engine-strict=false exec tsc --noEmit
```

手工验收要点：

1. 管理端测试 Agent 时打开 `returnTrace`，确认能看到 action、args、observation、stopReason。
2. 触发 `query_knowledge` / `query_memory`，确认字段别名或字符串参数能归一化为 `query`。
3. 故意让模型缺少 required 参数，确认提示为明确工具参数错误，而不是底层 `toLowerCase` 之类异常。
4. 将 `maxRounds` 设为较小值，确认重复相同工具错误会以 `invalid_tool_arguments` 或 `repeated_tool_error` 提前结束。
5. 通过 Workflow Agent step 调用 Agent，确认 Workflow 输出结构仍是原业务内容，不额外混入 trace。

ReAct 只影响 Agent 自身运行，不替代 Workflow。日报、评分等确定性管线仍由 Workflow DAG 和 batch executor 驱动。

## RAG 检索生产运维

RAG 主链由三段组成：知识库 chunk 写入、`rag_embedding_jobs` 任务化索引、统一检索服务。任何增强分支失败时，主查询必须降级到 FTS，并继续返回兼容的 `{ answer }`。

### 状态机

`GET /api/rag/status` 是运维判断入口，关键字段含义如下：

| 字段 | 含义 |
| ---- | ---- |
| `runtimeMode` | 当前主查询实际模式：`fts`、`hybrid`、`hybrid+rerank`、`degraded` |
| `readiness` | 可用性状态：`fts_only`、`indexing`、`hybrid_ready`、`degraded`、`rebuild_required` |
| `vectorStorageMode` | 向量存储状态：`pgvector_active`、`pgvector_available`、`jsonb_embedding`、`unavailable` |
| `coverage` | chunk 总量、已索引量、失败量、pending/running job 和覆盖率 |
| `dimensions` | 配置维度、已写入实际维度、数据库 pgvector 列维度 |
| `fallbackReason` | 当前降级原因，例如 embedding 服务缺失、覆盖率不足、维度不匹配 |
| `jobStats` | embedding job 按状态聚合的积压与失败情况 |

常见状态处理：

- `fts_only`：RAG 关闭，知识库查询保持 FTS 基线。
- `indexing`：有 pending/running job，等待任务完成或手动执行 run-once。
- `hybrid_ready`：覆盖率和维度满足要求，可进入 hybrid 或 hybrid+rerank。
- `degraded`：增强检索不可用，但 FTS 可用；先看 `fallbackReason`。
- `rebuild_required`：embedding 配置维度与数据库维度不一致，需要显式重建向量列/索引后再 reindex。

### pgvector 启用

Docker 生产部署已使用 `pgvector/pgvector:pg16`。已有 PostgreSQL 实例需要先启用扩展：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

应用启动迁移会检查并补齐 chunk 向量列、embedding 状态字段和 job 表。首次启用 pgvector 后，应在「设置 → RAG 检索」中执行 reindex，或调用：

```bash
curl -X POST "$LINKLOOM_BASE_URL/api/rag/reindex" \
  -H "authorization: Bearer $LINKLOOM_TOKEN" \
  -H "content-type: application/json" \
  -d '{"targetStorage":"dual","onlyMissing":true,"limit":100}'
```

### Reindex 与任务处理

`POST /api/rag/reindex` 只负责按筛选条件入队，不同步跑完整 embedding。常用参数：

- `dryRun`：只统计，不创建 job。
- `onlyMissing`：只补缺失或未索引 chunk。
- `documentIds` / `categoryIds`：收窄重建范围。
- `targetStorage`：`dual`、`pgvector`、`jsonb_embedding`。
- `limit`：单次扫描上限。

手动处理一小批任务：

```bash
curl -X POST "$LINKLOOM_BASE_URL/api/rag/jobs/run-once" \
  -H "authorization: Bearer $LINKLOOM_TOKEN" \
  -H "content-type: application/json" \
  -d '{"limit":16}'
```

查看最近任务：

```bash
curl "$LINKLOOM_BASE_URL/api/rag/jobs?status=failed&limit=20" \
  -H "authorization: Bearer $LINKLOOM_TOKEN"
```

### 维度变更

不要在保存设置时静默改数据库向量维度。维度变更流程：

1. 暂停或避开高峰期写入。
2. 确认新的 embedding 服务 `dimensions`。
3. 显式执行数据库向量列/索引重建流程。
4. 对目标文档执行 reindex。
5. 通过 `/api/rag/status` 确认 `dimensions.configured`、`dimensions.database`、`coverage.indexCoveragePercent` 达标。

维度不匹配时，job 会记录 `dimension_mismatch`，不会污染 pgvector；查询链路降级到 FTS 或 JSONB fallback。

### 降级排查

| 降级原因 | 处理方式 |
| -------- | -------- |
| `hybrid_disabled` | 在 RAG 策略中启用 hybrid，或保持 FTS 基线 |
| `embedding_service_unavailable` | 检查 active embedding 服务、baseUrl、model、apiKey 和连通性测试 |
| `embedding_jobs_pending` | 执行 run-once 或等待后台处理，观察 pending/running 数量 |
| `vector_coverage_below_threshold` | 执行 reindex，或临时降低 `minVectorCoverageForHybrid` |
| `dimension_mismatch` | 按维度变更流程重建向量列和索引 |
| `pgvector_unavailable_jsonb_fallback` | 启用 pgvector 扩展；短期可继续 JSONB fallback |
| `rerank_failed` | 检查 rerank 服务；查询会保留 hybrid 结果 |

### 冒烟验证

服务启动后可运行：

```bash
LINKLOOM_BASE_URL=http://127.0.0.1:3000 \
LINKLOOM_TOKEN="$TOKEN" \
pnpm run verify:rag-production
```

如果没有 token，也可以传 `LINKLOOM_PASSWORD`，脚本会先调用 `/api/login`。

该脚本会检查 status → reindex → jobs run-once → jobs list → `/api/kb/query`，断言 `answer`、`meta.retrievalMode`、coverage 和 job 字段存在。

## 提交规范（commitlint）

husky `commit-msg` 校验 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
<type>: <subject>
```

- **冒号后必须有空格**，例如 `fix: 修复精选页查询`，不要写 `fix:修复精选页查询`。
- 常用 `type`：`feat`、`fix`、`refactor`、`docs`、`chore`、`test`、`ci`、`build`。

配置见根目录 [`commitlint.config.js`](../commitlint.config.js)。

## 常用维护命令

| 命令                                   | 用途                                        |
| -------------------------------------- | ------------------------------------------- |
| `pnpm run backup:data`                 | 升级前备份（`pg_dump` + 可选 `data/` 目录） |
| `pnpm run doctor:data`                 | 数据目录与库连通性检查                      |
| `pnpm run db:stats` / `db:vacuum`      | 库统计 / `VACUUM ANALYZE`                   |
| `pnpm run db:archive` / `db:retention` | 归档 / 过期清理                             |
