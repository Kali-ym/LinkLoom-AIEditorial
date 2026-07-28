# Docker 部署资产

本目录包含 LinkLoom **生产镜像**与 **Compose 栈**；构建上下文仍为仓库根目录（`compose.yml` 中 `context: ../..`）。

| 文件 | 说明 |
| ---- | ---- |
| [`Dockerfile`](Dockerfile) | 多阶段镜像：pnpm install → `build:all` → Node 24 runtime |
| [`compose.yml`](compose.yml) | `pgvector/pgvector:pg16` + `linkloom` 服务 |
| [`agent/Dockerfile.demo`](agent/Dockerfile.demo) | Agent 沙箱 demo 镜像（`linkloom-agent:demo`） |

## 常用命令

```bash
# 推荐：一键部署（构建 + 启动 + 健康检查）
./deploy/docker-deploy.sh

# 手动 compose（须在仓库根目录设置 DATA_DIR/BACKUP_DIR 为绝对路径，或依赖默认值）
docker compose -f deploy/docker/compose.yml up -d --build

# 仅构建 Agent 沙箱 demo 镜像
./deploy/scripts/build-agent-image.sh
```
