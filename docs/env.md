# 环境变量参考

日常只需编辑根目录 [`.env.example`](../.env.example) 中列出的项；配置索引见 [`config/README.md`](../config/README.md)。下文为**可选 / 高级**变量（有合理默认值，一般不必配置）。

## 常用项速查

| 变量 | 说明 |
| ---- | ---- |
| `JWT_SECRET` | 管理端 JWT，生产必填 |
| `AI_BUILDER_POLICY_SECRET` | AI Builder 签名，生产必填 |
| `SYSTEM_PASSWORD` | 管理端 / Console 登录口令 |
| `PUBLIC_ORIGIN` / `CORS_ORIGINS` | 浏览器访问的根 URL，须与实际一致；独立 Console 的 origin 须写入 `CORS_ORIGINS` |
| `CONSOLE_PUBLIC_URL` | 可选。独立 Agent Console 公网地址；设置后 `/console` 与旧书签会 302 到该 URL |
| `POSTGRES_HOST` | `localhost`（本机）或 `postgres`（Docker 服务名） |
| `POSTGRES_PASSWORD` | 库密码；改密码需删 Docker 卷后重装 |
| `HOST_PUBLISH` | Compose 映射到宿主机的 `host:port`（默认 `0.0.0.0:3000`） |
| `VITE_AGENT_CONSOLE_DATA` | `api`（默认）或 `mock`；写入前端静态资源 |
| `DOCKER_BUILD_PROFILE` | Docker 构建内存档位：`low` / `normal` / `high` / `auto` |

连接串：未设置 `DATABASE_URL` 时，由 `POSTGRES_*` 自动拼接。容器内若 `DATABASE_URL` 仍写 `localhost`，运行时会**自动忽略**并改用 `postgres` 服务名（`docker-deploy.sh` 也会注释该行）。

## 前端构建变量（`VITE_*`）

| 变量 | 默认 | 说明 |
| ---- | ---- | ---- |
| `VITE_API_BASE_URL` | 空（同源） | admin / console API 基址 |
| `VITE_AGENT_CONSOLE_DATA` | `api` | `mock` 为离线演示，不需 backend |
| `VITE_SENTRY_DSN` 等 | 空 | 仅 `pnpm run build:admin` / `build:console` 时生效 |

`admin` 与 `agent-console` 的 Vite 均从**仓库根**加载 `.env`（`loadEnv(mode, '../', '')`），不在子包目录单独维护 env 文件。

Docker 构建时根 `.env` 被 `.dockerignore` 排除，`VITE_*` 与 `DOCKER_BUILD_*` 通过 compose `build.args` 从宿主机 `.env` 传入。

## Docker 部署

1. 复制 `.env.example` → `.env`
2. 将 `POSTGRES_HOST=postgres`（或由 `docker-deploy.sh` 自动设置）
3. 按需改 `PUBLIC_ORIGIN`、`CORS_ORIGINS`、`HOST_PUBLISH`、`DOCKER_BUILD_PROFILE`
4. `./deploy/docker-deploy.sh`

Compose **只读根目录 `.env`**，不在 `deploy/docker/compose.yml` 里重复写应用环境变量。

### Docker 镜像构建

| 变量 | 默认 | 说明 |
| ---- | ---- | ---- |
| `DOCKER_BUILD_PROFILE` | `low` | `low`≈1536MB堆 / `normal`≈3072 / `high`≈4096 / `auto` 按内存 |
| `DOCKER_BUILD_NODE_HEAP` | （随 profile） | 直接指定 Node 堆上限（MB），覆盖 profile |
| `DOCKER_BUILD_PARALLEL` | `serial` | `parallel` 并行构建前端（需 8GB+ 内存） |
| `APT_MIRROR` | `mirrors.aliyun.com` | 镜像构建 Debian 源 |
| `NPM_REGISTRY` | `registry.npmmirror.com` | 镜像构建 npm 源 |
| `OVERSEAS=1` | — | `docker-deploy.sh` 使用海外官方源 |

## 可选变量

### 进程与反代

| 变量 | 默认 | 说明 |
| ---- | ---- | ---- |
| `DATABASE_URL` | （由 POSTGRES\_\* 拼接） | 完整 Postgres URL，设置后覆盖拼接 |
| `TEST_DATABASE_URL` | 同 `DATABASE_URL` | 集成测试库 |
| `NEXT_UPSTREAM_URL` | `http://127.0.0.1:${NEXT_PORT}` | 反代 Next 地址 |
| `BACKEND_INTERNAL_URL` | `http://127.0.0.1:${PORT}` | 进程内自引用 |
| `SKIP_NEXT_RESTART` | `0` | `1` 时 Next 崩溃不自动重启 |
| `SITE_BASE_URL` | 空 | Feed/RSS 站点根 URL |

### 认证与限流

| 变量 | 默认 | 说明 |
| ---- | ---- | ---- |
| `AUTH_EXPIRE_TIME` | （库内设置） | 覆盖 JWT 过期策略 |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `60000` | 登录限流窗口 |
| `AUTH_RATE_LIMIT_MAX` | `20` | 窗口内最大尝试次数 |

### 观测

| 变量 | 默认 | 说明 |
| ---- | ---- | ---- |
| `SENTRY_DSN` | 空 | 后端 Sentry |
| `SENTRY_ENVIRONMENT` | `NODE_ENV` | |
| `SENTRY_RELEASE` | 空 | |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | |
| `LOG_FORMAT` | 文本 | 设为 `json` 输出 JSON 日志 |

### 安全与工具

| 变量 | 默认 | 说明 |
| ---- | ---- | ---- |
| `MEDIA_PROXY_TIMEOUT_MS` | `10000` | 媒体代理超时 |
| `MEDIA_PROXY_MAX_BYTES` | `10485760` | 媒体代理体积上限 |
| `ENABLE_EXECUTE_COMMAND_TOOL` | `0` | 生产执行 shell 工具 |
| `EXECUTE_COMMAND_TIMEOUT_MS` | `30000` | |
| `EXECUTE_COMMAND_MAX_BUFFER` | `1048576` | |
| `EXECUTE_COMMAND_AUTO_APPROVE` | `0` | |

### 维护与发布

| 变量 | 默认 | 说明 |
| ---- | ---- | ---- |
| `SOURCE_DATA_RETENTION_DAYS` | `365` | 源数据保留天数 |
| `WECHAT_SHARP_THREADS` | `1` | 微信发布器 |
| `WECHAT_FFMPEG_THREADS` | `1` | |
| `WECHAT_MAX_CONCURRENT` | `2` | |
| `GITHUB_REST_API_VERSION` | `2026-03-10` | GitHub REST 版本头 |

### Agent 沙箱与 Gateway

| 变量 | 默认 | 说明 |
| ---- | ---- | ---- |
| `LINKLOOM_MAX_SANDBOX_CONTAINERS` | `10` | 全局沙箱容器上限，`0` 不限制 |
| `LINKLOOM_AGENT_IMAGE` | `linkloom-agent:demo` | Agent 沙箱镜像 |
| `LINKLOOM_DOCKER_RUNTIME` | `auto` | `auto` / `docker` / `local` |
