# 部署资产索引

LinkLoom 生产部署以 **单进程 backend（含 admin / console 静态 + Next 反代）+ PostgreSQL** 为主。Docker 与脚本集中在 `deploy/`，环境变量说明见 [`config/README.md`](../config/README.md)。

## 目录结构

```
deploy/
├── docker-deploy.sh          # 入口包装（→ scripts/docker-deploy.sh）
├── postgres-migrate.sh
├── stack-migrate.sh
├── README.md                 # 本文件
├── docker/
│   ├── Dockerfile            # 生产镜像（构建 context = 仓库根）
│   ├── compose.yml           # Postgres + linkloom 栈
│   ├── README.md
│   └── agent/
│       └── Dockerfile.demo   # Agent 沙箱 demo（linkloom-agent:demo）
├── scripts/
│   ├── docker-deploy.sh      # 一键构建、启动、健康检查
│   ├── postgres-migrate.sh   # 单库导出 / 导入
│   ├── stack-migrate.sh      # LinkLoom + LocalFolo 跨设备迁移
│   └── build-agent-image.sh  # 构建沙箱 demo 镜像
└── systemd/
    └── linkloom.service      # 非 Docker 裸机示例
```

## 快速开始

```bash
# 项目根目录
./deploy/docker-deploy.sh
# 或
pnpm run deploy:docker
```

海外网络构建：

```bash
OVERSEAS=1 ./deploy/docker-deploy.sh
```

换机器时只需改 `.env` 中的 `DOCKER_BUILD_PROFILE`（`low` / `normal` / `high` / `auto`），见 `.env.example`。

完整说明见 [`docs/deployment.md`](../docs/deployment.md)。

## 子命令

| 命令 | 作用 |
| ---- | ---- |
| `./deploy/docker-deploy.sh` | 构建并启动 |
| `./deploy/docker-deploy.sh --no-build` | 仅启动（镜像已存在） |
| `./deploy/docker-deploy.sh --down` | 停止容器（保留 `pgdata`、`data/`） |
| `./deploy/docker-deploy.sh --reset-db` | 删除 Postgres 卷后重装 |
| `./deploy/docker-deploy.sh --logs` | 跟踪 linkloom 日志 |
| `./deploy/scripts/build-agent-image.sh` | 构建 `linkloom-agent:demo` |

## 跨设备迁移（LinkLoom + LocalFolo）

典型场景：**换机器**，把 LinkLoom（`linkloom` 库）和 LocalFolo（`folo` 库）**一起**迁走。

**新设备空库（覆盖，默认）**

```bash
# 旧设备
./deploy/stack-migrate.sh export ./backups/stack-move-20260528
# 拷贝到新设备

# 新设备
./deploy/stack-migrate.sh import ./backups/stack-move-20260528 --yes --create-db
./deploy/docker-deploy.sh --no-build
# LocalFolo 目录：./deploy/docker-deploy.sh --no-build
```

**两台设备都已有数据（追加，不覆盖）**

```bash
# 旧设备
./deploy/stack-migrate.sh export ./backups/stack-move --append

# 新设备（须先部署好应用并完成 schema 迁移）
./deploy/stack-migrate.sh import ./backups/stack-move --yes --append
```

迁移包内容（默认压缩 `.dump`）：

```
stack-move-20260528/
  linkloom.dump    # LinkLoom 全库
  folo.dump        # LocalFolo 全库
  manifest.json
```

LinkLoom 的 `data/` 文件资产（skills 等）不在 Postgres 里，需单独 `pnpm run backup:data` 或拷贝 `data/`；见 [`docs/backup-restore.md`](../docs/backup-restore.md)。

## 单库 PostgreSQL 工具

仅需迁移 **一个** 库时用 [`postgres-migrate.sh`](postgres-migrate.sh)：

```bash
./deploy/postgres-migrate.sh export
./deploy/postgres-migrate.sh import ./backups/pg-export-xxx.dump --yes
```

## 数据持久化

- PostgreSQL：Docker volume `linkloom_pgdata`
- 应用文件：`./data`、`./backups` 挂载到容器 `/app/data`、`/app/backups`

备份策略见 [`docs/backup-restore.md`](../docs/backup-restore.md)。
