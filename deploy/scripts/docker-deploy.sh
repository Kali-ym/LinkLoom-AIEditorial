#!/usr/bin/env bash
# LinkLoom 一键 Docker 部署（PostgreSQL + 应用单 compose 栈）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT}/deploy/docker/compose.yml"
ENV_FILE="${ROOT}/.env"

usage() {
  cat <<'EOF'
用法: ./deploy/docker-deploy.sh [选项]

  （无参数）    若无 .env 则从 .env.example 复制，构建镜像并启动 compose 栈
  --no-build    跳过镜像构建（镜像已存在时使用）
  --down        停止并移除容器（保留 pgdata / data / backups 卷与目录）
  --reset-db    停止并删除 Postgres 数据卷（改库密码前或密码不一致时用）
  --logs        跟踪 linkloom 服务日志
  --help        显示本帮助

环境变量：应用与数据库配置均在项目根目录 .env（见 .env.example、docs/env.md）。
  构建镜像可选（推荐写入 .env，见 DOCKER_BUILD_PROFILE）：
  DOCKER_BUILD_PROFILE   low | normal | high | auto（默认 low）
  DOCKER_BUILD_NODE_HEAP 直接指定 Node 堆上限 MB，覆盖 profile
  DOCKER_BUILD_PARALLEL  serial（默认）| parallel（8GB+）
  等价环境变量：APT_MIRROR、NPM_REGISTRY、OVERSEAS=1、LOW_MEMORY=1（强制 low）

示例:
  ./deploy/docker-deploy.sh
  OVERSEAS=1 ./deploy/docker-deploy.sh
  ./deploy/docker-deploy.sh --down
  ./deploy/docker-deploy.sh --reset-db   # 清空 pgdata 后需重新 deploy
EOF
}

postgres_pgdata_volume_exists() {
  docker volume ls -q 2>/dev/null | grep -q 'pgdata'
}

log() { printf '\033[1;34m==>\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33m!!>\033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31mERR>\033[0m %s\n' "$*" >&2; }

resolve_compose() {
  # linkloom 项目名曾出现 Docker 幽灵容器（compose 反复 recreate 已删 ID），默认用 linkloom2
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-linkloom2}"
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME")
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME")
  else
    err "未找到 Docker Compose。请安装 Docker Engine 并启用 compose 插件。"
    exit 1
  fi
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    err "未找到 docker 命令，请先安装 Docker。"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    err "Docker 守护进程未运行或当前用户无权限。请启动 Docker 或将用户加入 docker 组。"
    exit 1
  fi
}

set_env_line() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

read_env_var() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  local line
  line=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 || true)
  [[ -n "$line" ]] || return 0
  local value="${line#*=}"
  value="${value%$'\r'}"
  value="${value#\"}"; value="${value%\"}"
  value="${value#\'}"; value="${value%\'}"
  printf '%s' "$value"
}

load_deploy_env() {
  # 将 .env 中的构建相关变量载入当前 shell（compose 也会自动读 .env）
  local profile heap parallel vite_mode vite_api
  profile=$(read_env_var DOCKER_BUILD_PROFILE)
  heap=$(read_env_var DOCKER_BUILD_NODE_HEAP)
  parallel=$(read_env_var DOCKER_BUILD_PARALLEL)
  vite_mode=$(read_env_var VITE_AGENT_CONSOLE_DATA)
  vite_api=$(read_env_var VITE_API_BASE_URL)

  if [[ -n "$profile" ]]; then export DOCKER_BUILD_PROFILE="$profile"; fi
  if [[ -n "$heap" ]]; then export DOCKER_BUILD_NODE_HEAP="$heap"; fi
  if [[ -n "$parallel" ]]; then export DOCKER_BUILD_PARALLEL="$parallel"; fi
  if [[ -n "$vite_mode" ]]; then export VITE_AGENT_CONSOLE_DATA="$vite_mode"; fi
  if [[ -n "$vite_api" ]]; then export VITE_API_BASE_URL="$vite_api"; fi
}

profile_heap_mb() {
  case "${1:-low}" in
    low ) echo 1280 ;;
    normal ) echo 2560 ;;
    high ) echo 4096 ;;
    auto ) echo auto ;;
    * ) warn "未知 DOCKER_BUILD_PROFILE=$1，回退 low"; echo 1536 ;;
  esac
}

apply_build_memory() {
  load_deploy_env

  if [[ "${LOW_MEMORY:-}" == "1" ]]; then
    export DOCKER_BUILD_PROFILE=low
  fi

  if [[ -n "${DOCKER_BUILD_NODE_HEAP:-}" ]]; then
    export BUILD_NODE_MAX_OLD_SPACE_SIZE="$DOCKER_BUILD_NODE_HEAP"
  else
    local profile heap
    profile="${DOCKER_BUILD_PROFILE:-low}"
    heap=$(profile_heap_mb "$profile")
    if [[ "$heap" == auto ]]; then
      if [[ -r /proc/meminfo ]]; then
        local mem_kb
        mem_kb=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
        if (( mem_kb < 4000000 )); then
          export BUILD_NODE_MAX_OLD_SPACE_SIZE=1280
        elif (( mem_kb < 16000000 )); then
          export BUILD_NODE_MAX_OLD_SPACE_SIZE=2560
        else
          export BUILD_NODE_MAX_OLD_SPACE_SIZE=4096
        fi
        log "DOCKER_BUILD_PROFILE=auto：检测到约 $((mem_kb / 1024))MB 内存，heap=${BUILD_NODE_MAX_OLD_SPACE_SIZE}MB"
      else
        export BUILD_NODE_MAX_OLD_SPACE_SIZE=1280
      fi
    else
      export BUILD_NODE_MAX_OLD_SPACE_SIZE="$heap"
    fi
  fi

  export DOCKER_BUILD_PARALLEL="${DOCKER_BUILD_PARALLEL:-serial}"
  log "Docker 构建：profile=${DOCKER_BUILD_PROFILE:-custom} heap=${BUILD_NODE_MAX_OLD_SPACE_SIZE}MB parallel=${DOCKER_BUILD_PARALLEL}"
}

host_prebuild_app() {
  load_deploy_env
  export VITE_API_BASE_URL="${VITE_API_BASE_URL:-}"

  local host_heap="${HOST_BUILD_NODE_HEAP:-4096}"
  log "宿主机预构建 backend + admin（heap=${host_heap}MB；agent-console 已独立托管，不打进镜像）…"
  pnpm run build:backend
  NODE_OPTIONS="--max-old-space-size=${host_heap}" pnpm --filter ./admin run build
  export SKIP_APP_BUILD=1
}

prepare_deploy() {
  if [[ ! -f "$ENV_FILE" ]]; then
    log "未找到 .env，从 .env.example 复制 …"
    cp "${ROOT}/.env.example" "$ENV_FILE"
    warn "请编辑 .env：JWT_SECRET、SYSTEM_PASSWORD、PUBLIC_ORIGIN 等（见 .env.example）。"
  fi

  # Docker 栈：统一库主机名，避免 .env 里残留的 localhost / DATABASE_URL
  if grep -qE '^POSTGRES_HOST=(localhost|127\.0\.0\.1)' "$ENV_FILE" 2>/dev/null; then
    log "Docker 部署：已将 POSTGRES_HOST 设为 postgres"
    set_env_line POSTGRES_HOST postgres
  fi
  if grep -qE '^DATABASE_URL=.*@(localhost|127\.0\.0\.1)' "$ENV_FILE" 2>/dev/null; then
    log "Docker 部署：已注释 .env 中指向本机的 DATABASE_URL（改用 POSTGRES_*）"
    sed -i 's/^DATABASE_URL=/# DATABASE_URL=/' "$ENV_FILE"
  fi

  if postgres_pgdata_volume_exists; then
    warn "已有 Postgres 数据卷：.env 中 POSTGRES_PASSWORD 须与卷初始化时一致。"
    warn "密码不一致时可执行: ./deploy/docker-deploy.sh --reset-db"
  fi

  mkdir -p "${ROOT}/data" "${ROOT}/backups"
  export DATA_DIR="${ROOT}/data"
  export BACKUP_DIR="${ROOT}/backups"

  if ! docker volume inspect linkloom_pgdata >/dev/null 2>&1; then
    log "创建 Postgres 数据卷 linkloom_pgdata …"
    docker volume create linkloom_pgdata >/dev/null
  fi
}

apply_build_mirrors() {
  if [[ "${OVERSEAS:-}" == "1" ]]; then
    export APT_MIRROR="${APT_MIRROR:-deb.debian.org}"
    export NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
    log "OVERSEAS=1：构建使用 ${APT_MIRROR} / ${NPM_REGISTRY}"
  else
    export APT_MIRROR="${APT_MIRROR:-mirrors.aliyun.com}"
    export NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
  fi
}

wait_for_ready() {
  local url="${1:-http://127.0.0.1:3000/api/ready}"
  local deadline=$((SECONDS + 300))
  log "等待就绪检查 ${url}（最长 5 分钟，首次构建可能较久）…"
  while (( SECONDS < deadline )); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    if "${COMPOSE[@]}" ps --status running linkloom 2>/dev/null | grep -q linkloom; then
      :
    else
      warn "linkloom 容器未在运行，查看日志: ${COMPOSE[*]} logs --tail=80 linkloom"
      return 1
    fi
    sleep 5
  done
  return 1
}

compose_up() {
  if "${COMPOSE[@]}" up -d "$@"; then
    return 0
  fi

  warn "compose up 失败（多为 Docker 幽灵容器/陈旧 compose 状态），尝试 force-recreate …"
  "${COMPOSE[@]}" down --remove-orphans 2>/dev/null || true
  if "${COMPOSE[@]}" up -d --force-recreate --remove-orphans "$@"; then
    return 0
  fi

  err "仍无法启动。可尝试: sudo systemctl restart docker；或 COMPOSE_PROJECT_NAME=linkloom3 ./deploy/docker-deploy.sh"
  return 1
}

cmd_up() {
  local do_build=1
  if [[ "${1:-}" == --no-build ]]; then
    do_build=0
  fi

  require_docker
  resolve_compose
  cd "$ROOT"

  prepare_deploy
  apply_build_mirrors
  apply_build_memory

  export DOCKER_BUILDKIT=1
  export BUILDKIT_PROGRESS=plain

  if (( do_build )); then
    host_prebuild_app
    log "打包 Docker 镜像 …"
    "${COMPOSE[@]}" build \
      --build-arg "APT_MIRROR=${APT_MIRROR}" \
      --build-arg "NPM_REGISTRY=${NPM_REGISTRY}" \
      --build-arg "BUILD_NODE_MAX_OLD_SPACE_SIZE=${BUILD_NODE_MAX_OLD_SPACE_SIZE}" \
      --build-arg "DOCKER_BUILD_PARALLEL=${DOCKER_BUILD_PARALLEL}" \
      --build-arg "SKIP_APP_BUILD=${SKIP_APP_BUILD:-1}" \
      --build-arg "VITE_AGENT_CONSOLE_DATA=${VITE_AGENT_CONSOLE_DATA:-api}" \
      --build-arg "VITE_API_BASE_URL=${VITE_API_BASE_URL:-}"
  fi

  log "启动服务 …"
  compose_up || exit 1

  if wait_for_ready; then
    log "部署完成。"
    echo ""
    echo "  管理后台: ${PUBLIC_ORIGIN:-http://127.0.0.1:3000}/admin/login"
    echo "  公共站点: ${PUBLIC_ORIGIN:-http://127.0.0.1:3000}/"
    echo "  健康检查: http://127.0.0.1:3000/api/health"
    echo "  账号与密钥: 见项目根目录 .env（脚本不会修改或生成密码）"
    echo ""
    echo "  查看日志: ./deploy/docker-deploy.sh --logs"
    echo "  停止服务: ./deploy/docker-deploy.sh --down"
  else
    err "就绪检查超时。请执行: ${COMPOSE[*]} logs -f linkloom"
    exit 1
  fi
}

cmd_down() {
  require_docker
  resolve_compose
  cd "$ROOT"
  log "停止 compose 栈（保留数据卷与 ./data、./backups）…"
  "${COMPOSE[@]}" down
}

cmd_reset_db() {
  require_docker
  resolve_compose
  cd "$ROOT"
  warn "将停止服务并删除 Postgres 卷 pgdata（库内数据将丢失，请先备份）。"
  "${COMPOSE[@]}" down --remove-orphans
  if docker volume inspect linkloom_pgdata >/dev/null 2>&1; then
    docker volume rm linkloom_pgdata
  fi
  log "已删除 linkloom_pgdata。请重新执行 ./deploy/docker-deploy.sh 初始化数据库。"
}

cmd_logs() {
  require_docker
  resolve_compose
  cd "$ROOT"
  "${COMPOSE[@]}" logs -f linkloom
}

main() {
  case "${1:-}" in
    '' ) cmd_up ;;
    --no-build ) cmd_up --no-build ;;
    --down ) cmd_down ;;
    --reset-db ) cmd_reset_db ;;
    --logs ) cmd_logs ;;
    -h | --help ) usage ;;
    * )
      err "未知参数: $1"
      usage
      exit 1
      ;;
  esac
}

main "$@"
