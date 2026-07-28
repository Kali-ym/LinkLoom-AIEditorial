# 项目结构说明

LinkLoom 是 **pnpm workspace monorepo**：根目录承载 backend 源码与依赖，`admin` / `agent-console` / `web` 为三个前端子包。下文描述与磁盘布局一致，便于 onboarding 与运维。

## 顶层一览

```
LinkLoom/
├── backend/                 # Node.js / Fastify 后端（无独立 package.json，依赖在根）
│   ├── src/                 # TypeScript 源码 → 编译到 backend/dist/
│   ├── skills/              # 内置 Skill（构建时拷贝到 dist/skills）
│   ├── templates/           # 工作流 JSON 模板（构建时拷贝到 dist/templates）
│   ├── scripts/             # 构建辅助、DB 维护、集成冒烟（*.mjs）
│   └── tests/               # Vitest 单元测试
├── admin/                   # React 19 + Vite 6 管理后台（运营配置、AI Builder、运营中心）
├── agent-console/           # React 19 + Vite 6 Agent 对话控制台（独立 SPA，/console/）
├── web/                     # Next.js 16 公共站点（App Router）
├── docs/                    # 运维与架构文档（本文件所在目录）
│   ├── gateway/             # Agent Gateway 规格与 PR 说明
│   ├── design/agent-console/ # 控制台设计/runbook
│   ├── reference-workflows/ # 参考工作流 YAML（不参与构建）
│   └── superpowers/         # 功能规划与实施记录（plans / specs）
├── config/                  # 仓库配置与根目录文件索引（config/README.md）
├── deploy/                  # Docker 镜像、compose、部署与迁移脚本
│   ├── docker/              # Dockerfile · compose.yml · agent 沙箱镜像
│   ├── scripts/             # docker-deploy · postgres/stack 迁移
│   └── systemd/             # linkloom.service 示例
├── infra/                   # 基础设施辅助资产
│   └── seeds/               # channel 平台 / binding 种子 JSON
├── scripts/                 # 仓库级质量门禁（编码、可维护性）
├── e2e/                     # Playwright 端到端测试
├── data/                    # 运行时目录（gitignore）：用户 Skill、上传、缓存等
├── backups/                 # 备份输出（gitignore）
└── package.json             # 根脚本：dev / build / test / deploy:docker
```

### 开发工具目录（不入业务构建）

| 目录 | 用途 |
| ---- | ---- |
| `.agents/` | 仓库级 AI Agent Skills（含 `skills-lock.json`） |
| `.cursor/` | Cursor IDE 规则与本地 skills |
| `.superpowers/` | Superpowers brainstorm 会话缓存 |
| `.codex/` | Codex 本地配置 |
| `sandbox/` | 本地实验目录（gitignore） |

---

## 四端职责

| 包 / 目录 | 技术栈 | 开发端口 | 生产路径 | 职责 |
| --------- | ------ | -------- | -------- | ---- |
| `backend` | Fastify + TS | `3000` | `/api/*` + 静态托管 | REST/SSE、调度、工作流、插件、反代 Next |
| `admin` | React + Vite | `5173` | `/admin/` | 调度、筛选、多智能体配置、AI Builder、运营中心 |
| `agent-console` | React + Vite | `5174` | 独立托管（连接任意 backend） | 对话运行时：话题、流式回复、工具 Portal、工作区、Cmd+K |
| `web` | Next.js 16 | `3100` | `/`（backend 反代） | 读者日报、归档、RSS |

开发时各前端可独立热更新；**生产暴露 backend 的 `3000`（admin/web）**，Agent Console 单独托管并用实例地址 + AI 互联 API Key 连接。旧书签 `/admin/agents/console/*` 与 `/console/*` 在配置了 `CONSOLE_PUBLIC_URL` 时会 302 到独立 Console。

`admin` 与 `agent-console` **零代码共享**：admin 用密码 JWT（`auth_token`）；独立 console 用实例连接会话（`console_connection`：Base URL + Interop API Key）。

---

## Backend 源码分层

```
backend/src/
├── api/              # HTTP：server.ts、routes/*（未来 → presentation/）
├── domain/           # errors、editorial、ports（与框架无关）
├── services/         # 业务编排
│   ├── api/          # *RouteService（未来 → application/<context>/）
│   ├── agents/       # WorkflowEngine、SkillService、ReAct 引擎、批处理
│   ├── aiBuilder/    # 对话式构建 Agent/Workflow
│   ├── gateway/      # AgentGateway、ChannelBindingStore
│   ├── rag/          # 混合检索、embedding jobs
│   ├── memory/ · knowledge/
│   ├── repositories/ # PostgreSQL + mappers/
│   └── bootstrap/ · seeders/ · maintenance/
├── plugins/          # base/ + builtin/（适配器、发布器、Tool）
├── registries/       # 插件注册表
├── prompts/          # AI 提示词 .md（构建 → dist/prompts）
├── types/ · utils/ · shared/
└── index.ts          # 进程入口
```

依赖方向：`api` → `services` → `domain`；`repositories` / `plugins` 实现 `domain/ports`。

---

## Agent Console 源码分层

```
agent-console/src/
├── adapters/         # API / SSE / mock 端口
├── features/         # 对话、侧栏、Portal、Cmd+K、输入区等 UI 功能块
├── stores/           # Zustand 状态（agent、topic、layout、stream…）
├── routes/           # React Router 与旧 URL 兼容重定向
├── layout/           # 全屏 Shell（无 admin 侧栏）
├── domain/           # 控制台专属领域类型与工具 catalog 常量
├── pages/            # Login、AgentConsolePage
├── context/ · providers/ · hooks/ · components/
├── i18n/ · styles/ · constants/ · utils/
└── test/ · __smoke__/ · fixtures/ · mock/
```

构建产物由独立静态站托管（Vite `base` 仍为 `/console/`）；运行时通过连接页填写的 Base URL + Interop API Key 访问 backend，不再由生产镜像内嵌。

---

## Admin 页面地图

```
admin/src/pages/
├── scheduling/       # 调度中心
├── selection/        # 内容筛选
├── generation/       # 生成预览
├── agents/           # 多智能体配置（Agents / Skills / Workflows / Tools + AI Builder）
├── ops/              # 运营中心（健康 / 运行 / 审批 / RAG / 平台）
├── KnowledgeBase.tsx # 知识与记忆
├── History.tsx       # 历史存档
└── settings/         # 系统设置
```

工具 catalog 共享逻辑在 `admin/src/domain/consoleCatalog.ts`（与 agent-console 侧 `domain/constants/adminExclusiveTools.ts` 语义对齐，各自维护）。

---

## 资源文件（内置 vs 运行时）

| 类型            | 仓库路径                    | 构建产物                  | 运行时扩展                               |
| --------------- | --------------------------- | ------------------------- | ---------------------------------------- |
| Prompts         | `backend/src/prompts/`      | `backend/dist/prompts/`   | —                                        |
| 工作流模板      | `backend/templates/`        | `backend/dist/templates/` | —                                        |
| 内置 Skill      | `backend/skills/`           | `backend/dist/skills/`    | —                                        |
| 用户 Skill      | —                           | —                         | `data/skills/`（`AgentRepository` 管理） |
| 参考工作流 YAML | `docs/reference-workflows/` | 不参与构建                | 仅供文档/导入参考                        |

`SkillService` 扫描顺序（后者覆盖前者）：`data/skills` → `backend/skills`（开发）/ `backend/dist/skills`（生产）等，详见 [`SkillService`](../backend/src/services/agents/SkillService.ts)。

`data/hugo_cache/` 为早期 Hugo 站点遗留缓存，可安全删除；当前公共站点已迁移至 `web/`（Next.js）。

---

## 脚本分布

| 目录                             | 用途                                         |
| -------------------------------- | -------------------------------------------- |
| 根 `package.json` scripts        | 开发、构建、测试、CI、Docker 部署入口        |
| `scripts/`                       | `check:encoding`、`check:maintainability`    |
| `backend/scripts/`               | `copy-assets.js`、DB 维护、`test-*.mjs` 冒烟 |
| `admin/scripts/`、`web/scripts/` | 各前端专用（如 standalone 资产拷贝）         |
| `agent-console/src/scripts/`     | 控制台 CSS 迁移审计等                        |

常用开发命令：

| 命令 | 说明 |
| ---- | ---- |
| `pnpm run dev:backend` | 后端 tsx watch，`3000` |
| `pnpm run dev:admin` | 管理端 Vite，`5173` |
| `pnpm run dev:console` | Agent 控制台 Vite，`5174`（**默认不随 `dev:all` 启动**） |
| `pnpm run dev:web` | Next.js dev，`3100` |
| `pnpm run dev:all` | 三端并行：backend + admin + web（排除 console） |
| `pnpm run build:all` | Turborepo 并行构建（默认 `--filter=!linkloom-agent-console`） |
| `pnpm run build:console` | 显式构建独立 Agent Console |

---

## 测试分层

| 层级     | 位置 / 命令                                                      |
| -------- | ---------------------------------------------------------------- |
| 单元     | `backend/tests/*.test.ts` + `admin`/`web` 单测 → `pnpm run test:unit`（console 单测用 `pnpm --filter ./agent-console test`） |
| 后端冒烟 | `backend/scripts/test-*.mjs` → `pnpm run test:backend-smoke`     |
| 管理端   | `admin` 内 workflow-utils → `pnpm run test:admin-workflow-utils` |
| E2E      | `e2e/` → `pnpm run test:e2e`                                     |

---

## 部署相关文件

Docker 构建上下文为**仓库根**（`deploy/docker/compose.yml` 中 `context: ../..`）。`deploy/docker/` 存放生产镜像与 compose；`deploy/scripts/` 为部署与迁移脚本。镜像内打包 `admin/dist`、`web/.next`（**不再**内嵌 `agent-console/dist`）。详见 [`deploy/README.md`](../deploy/README.md)、[`config/README.md`](../config/README.md) 与 [`deployment.md`](deployment.md)。

---

## 计划中的结构调整（勿与日常整理混做）

README §15 / §7 已记录，**单独排期**：

- `api/` → `presentation/`
- `services/api/` → `application/<context>/`
- 将 `services/` 根目录零散 `*Service.ts` 逐步收入子目录

当前保持现有 import 路径，避免破坏插件与 CI。
