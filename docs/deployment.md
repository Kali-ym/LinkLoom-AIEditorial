# 部署指南

部署相关文件索引见 [`deploy/README.md`](../deploy/README.md) 与 [`config/README.md`](../config/README.md)。

## 推荐：一键 Docker 部署

在项目根目录执行（若无 `.env` 则从 `.env.example` 复制一份，**不会**改写其中的密钥或密码；请自行编辑后再部署）：

```bash
chmod +x deploy/docker-deploy.sh   # 首次可选
./deploy/docker-deploy.sh
# 或
pnpm run deploy:docker
```

海外网络可改用官方源加速构建：

```bash
OVERSEAS=1 ./deploy/docker-deploy.sh
```

常用子命令：`--down`（停止）、`--logs`（日志）、`--no-build`（跳过构建）、`--reset-db`（删除 Postgres 卷，用于密码与 pgdata 不一致时）。

**密码与数据卷**：`POSTGRES_PASSWORD` 只在 **首次** 创建 `pgdata` 卷时写入 Postgres。若之后修改 `.env` 中的密码而未删卷，应用会报 `password authentication failed`，需 `--reset-db` 后重新部署，或把密码改回与卷一致（默认常为 `linkloom`）。

## 手动：Docker Compose

1. 复制 `.env.example` 为 `.env`，按注释填写（生产必填 `JWT_SECRET` 等；Docker 将 `POSTGRES_HOST` 设为 `postgres`）。详见 [`env.md`](env.md)。
2. 构建并启动：

```bash
DOCKER_BUILDKIT=1 BUILDKIT_PROGRESS=plain docker compose -f deploy/docker/compose.yml up -d --build
```

首次构建 `pnpm install` 通常需要 **10～20 分钟**（Next.js + `sharp` 等原生模块），日志里应持续有下载/编译输出；若超过 25 分钟无新输出再排查网络。

- 镜像内通过 npm registry 安装 `pnpm@11.5.1`（与 `package.json` 的 `packageManager` 一致），运行时使用 Node 24.15。
- `deploy/docker/compose.yml` 包含 PostgreSQL 服务（`postgres`），使用 `pgvector/pgvector:pg16` 镜像以支持 RAG 向量检索；数据持久化在 `pgdata` volume；`linkloom` 服务通过 `POSTGRES_*` 连接 `postgres` 服务。
- 默认 apt 源为 `mirrors.aliyun.com`、npm 为 `registry.npmmirror.com`；海外环境可在 compose 里改 `APT_MIRROR=deb.debian.org`、`NPM_REGISTRY=https://registry.npmjs.org`。
- 重复构建会复用 pnpm store 缓存，明显快于首次。

3. 访问 `http://127.0.0.1:3000/api/health` 检查存活状态。Docker 已将 `3000` 发布到 **`0.0.0.0:3000`**，局域网可用 `http://<主机IP>:3000/` 访问；须在 `.env` 将 `PUBLIC_ORIGIN` 与 `CORS_ORIGINS` 设为实际访问地址（例如 `http://192.168.1.10:3000`）。独立 Agent Console 的 origin 也须写入 `CORS_ORIGINS`；可选设置 `CONSOLE_PUBLIC_URL` 指向 Console 站点。

首次启用 RAG 向量检索后，在管理端「设置 → RAG 检索」执行 reindex；也可以用 `LINKLOOM_TOKEN` 或 `LINKLOOM_PASSWORD` 运行：

```bash
LINKLOOM_BASE_URL=http://127.0.0.1:3000 pnpm run verify:rag-production
```

生产反代只需要转发到 backend `PORT`，不要暴露 `NEXT_PORT`。

## systemd

1. 在目标机安装 Node.js 24.15、PostgreSQL 16；pnpm 用 `corepack enable && corepack prepare pnpm@11.5.1 --activate`。
2. 配置 PostgreSQL：创建 `linkloom` 用户和数据库，并写入 `.env` 的 `DATABASE_URL`。
3. 在 `/opt/linkloom` 执行 `pnpm install --frozen-lockfile && pnpm run build:all`。
4. 放置 `.env`，确保 `DATABASE_URL` 指向 PostgreSQL。
5. 复制 `deploy/systemd/linkloom.service` 到 `/etc/systemd/system/linkloom.service`。
6. 执行 `systemctl daemon-reload && systemctl enable --now linkloom`。

## 健康检查

- `/api/health`：进程是否存活。
- `/api/ready`：数据库、scheduler、Next upstream 是否可用。
- `/api/admin/status`：管理员登录后查看轻量运行指标。
- `/api/metrics`：Prometheus 格式指标。
