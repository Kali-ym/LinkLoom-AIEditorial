# 仓库配置与根目录索引

LinkLoom 是 **pnpm workspace monorepo**：根目录放全栈共享配置与子包目录，**不是** backend 专用目录。

---

## 一、环境变量（运行时 + 构建）

| 文件 | 用途 |
| ---- | ---- |
| [`.env.example`](../.env.example) | **主配置模板** — `cp .env.example .env` 后修改 |
| [`.env`](../.env) | 本地/生产实际配置（gitignore，不进镜像） |
| [`docs/env.md`](../docs/env.md) | 高级 / 可选变量完整参考 |

**谁读根 `.env`：**

| 消费者 | 典型变量 |
| ------ | -------- |
| backend | `JWT_SECRET`、`POSTGRES_*`、`PORT` |
| Docker Compose | 同上 + `HOST_PUBLISH`、`DATA_DIR` |
| admin / agent-console（Vite） | `VITE_*`（`loadEnv` 读仓库根） |
| web（Next） | `BACKEND_INTERNAL_URL`、`NEXT_PORT` |
| docker-deploy.sh | `DOCKER_BUILD_PROFILE` 等构建参数 |

各前端**不在子包目录**单独维护 `.env` 文件。Compose 只读根 `.env`。

### `.env.example` 章节

| 章节 | 主要变量 |
| ---- | -------- |
| 1. 安全 | `JWT_SECRET`, `SYSTEM_PASSWORD` |
| 2. 对外访问 | `PUBLIC_ORIGIN`, `CORS_ORIGINS`, `CONSOLE_PUBLIC_URL` |
| 3. HTTP 服务 | `PORT`, `HOST_PUBLISH` |
| 4. 前端构建 | `VITE_API_BASE_URL`（admin）；console 独立构建 |
| 5. PostgreSQL | `POSTGRES_*` |
| 6. Next 子进程 | `NEXT_PORT`, `SKIP_NEXT_SPAWN` |
| 7. 本地目录 | `DATA_DIR`, `BACKUP_DIR` |
| 8. Docker 构建 | `DOCKER_BUILD_PROFILE` |
| 9. 可选功能 | 见 `docs/env.md` |

### 快速开始

```bash
# 本机开发
cp .env.example .env && pnpm run dev:all

# Docker 部署
cp .env.example .env && ./deploy/docker-deploy.sh
```

换机器改构建内存：`DOCKER_BUILD_PROFILE=low|normal|high|auto`

---

## 二、根目录文件一览

### 环境与部署

| 文件 / 目录 | 说明 |
| ----------- | ---- |
| `.env.example` | 环境变量模板（全栈） |
| `config/` | **本索引** + 配置文档 |
| `deploy/` | Docker、systemd、迁移脚本 |
| `data/` | 运行时文件资产（gitignore） |
| `backups/` | 备份输出（gitignore） |

### Monorepo 工程

| 文件 | 说明 |
| ---- | ---- |
| `package.json` | 根脚本：`dev:*`、`build:*`、`test`、`ci`、`deploy:docker` |
| `pnpm-workspace.yaml` | workspace 包：`admin`、`web`、`agent-console`（默认脚本/CI/Docker 排除 console） |
| `pnpm-lock.yaml` | 依赖锁定 |
| `.npmrc` | pnpm 行为（registry、hoist 等） |
| `turbo.json` | Turborepo 任务编排；`build:all` 等默认排除 `linkloom-agent-console` |
| `tsconfig.json` | backend TypeScript 编译配置 |

### 质量与测试（仓库级）

| 文件 | 说明 |
| ---- | ---- |
| `eslint.config.mjs` | 根 ESLint（backend、e2e、scripts；各前端包自有 eslint） |
| `vitest.config.ts` | 根单元测试（backend + admin + web） |
| `playwright.config.ts` | E2E 测试 |
| `.prettierrc.json` / `.prettierignore` | 格式化 |
| `scripts/` | 编码 / 可维护性门禁脚本 |

### 项目元数据

| 文件 | 说明 |
| ---- | ---- |
| `README.md` | 项目主文档 |
| `CHANGELOG.md` | 版本变更记录 |
| `LICENSE` | MIT |
| `version` | 当前版本号（Docker 镜像、前端 `__APP_VERSION__` 读取） |

### 子包与文档

| 目录 | 说明 |
| ---- | ---- |
| `backend/` | Fastify API、调度、Agent 引擎（依赖在根 `package.json`） |
| `admin/` | 管理后台 → `/admin/` |
| `agent-console/` | Agent 控制台（独立部署，连接 backend） |
| `web/` | Next.js 读者站 → `/` |
| `docs/` | 架构、运维、设计文档 |
| `e2e/` | Playwright 端到端 |
| `infra/seeds/` | Channel 种子 JSON |

### 开发工具（不入业务构建）

| 目录 / 文件 | 说明 |
| ----------- | ---- |
| `.agents/` | 仓库级 Agent Skills + `skills-lock.json` |
| `.cursor/` | Cursor 规则与 skills |
| `.changeset/` | 版本发布 changeset 配置 |
| `.github/` | CI workflow |
| `sandbox/` | 本地实验（gitignore） |

### 隐藏 / 忽略文件

| 文件 | 说明 |
| ---- | ---- |
| `.gitignore` | Git 忽略规则 |
| `.dockerignore` | Docker 构建上下文排除（含 `.env`） |
| `.cursorignore` | Cursor 索引排除 |
| `.editorconfig` | 编辑器基础风格 |

---

## 三、部署相关配置（不在根目录）

| 文件 | 用途 |
| ---- | ---- |
| [`deploy/docker/compose.yml`](../deploy/docker/compose.yml) | Postgres + linkloom 栈 |
| [`deploy/docker/Dockerfile`](../deploy/docker/Dockerfile) | 生产镜像多阶段构建 |
| [`deploy/scripts/docker-deploy.sh`](../deploy/scripts/docker-deploy.sh) | 一键构建部署 |
| [`deploy/systemd/linkloom.service`](../deploy/systemd/linkloom.service) | 裸机 systemd 示例 |

---

## 四、代码内配置（非 `.env`）

| 位置 | 说明 |
| ---- | ---- |
| `backend/src/config/` | 业务枚举、运行时 env 解析逻辑 |
| `admin/src/config/` | Admin 品牌文案等前端常量 |
| `agent-console/src/constants/` | Console 路由、热键等 |
| 各包 `vite.config.ts` / `next.config.mjs` | 构建与 dev server（读根 `.env` 的 `PORT` 等） |

---

## 五、为何这些文件留在根目录

Monorepo 约定：`package.json`、`pnpm-workspace.yaml`、`turbo.json`、ESLint/Vitest/Prettier 配置放在根目录，工具链才能默认识别。  
**可迁移的**只有文档索引（`config/`）和部署资产（`deploy/`）；**不应**把 `.env` 或 `package.json` 挪进 `backend/`。

更完整的目录树见 [`docs/STRUCTURE.md`](../docs/STRUCTURE.md)。
