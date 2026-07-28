#!/usr/bin/env bash
# LinkLoom + LocalFolo 跨设备 PostgreSQL 整栈迁移（同时导出/导入 linkloom 与 folo 两库）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_MIGRATE="${ROOT}/deploy/scripts/postgres-migrate.sh"
DEFAULT_BACKUP_DIR="${ROOT}/backups"

LINKLOOM_DB="${LINKLOOM_DB:-linkloom}"
FOLO_DB="${FOLO_DB:-folo}"

usage() {
  cat <<'EOF'
用法: ./deploy/stack-migrate.sh <命令> [选项] [路径]

跨设备迁移 LinkLoom + LocalFolo 的 PostgreSQL 数据（linkloom 库 + folo 库，一并打包）。

命令:
  export [目录]     在源设备导出两库到同一目录（默认压缩 .dump）
  import <目录>     在目标设备从目录恢复两库
  bundle [目录]     export 的别名

选项:
  --yes             import 前不交互确认
  --create-db       目标库不存在时自动创建
  --append          追加模式：目标库已有数据时不覆盖，只插入新数据（冲突行跳过）
  --replace         覆盖模式（默认）：DROP 后全量恢复（空库 / 新机首选）
  --from-url URL    源 Postgres（export 时）
  --to-url URL      目标 Postgres（import 时）

跨设备流程（两台机器都已有库 → 用 --append）:
  # 1. 旧设备
  ./deploy/stack-migrate.sh export ./backups/stack-move --append

  # 2. 拷贝目录到新设备

  # 3. 新设备（目标库须已部署且 schema 已迁移）
  ./deploy/stack-migrate.sh import ./backups/stack-move --yes --append

跨设备流程（新设备空库 → 默认覆盖即可）:
  ./deploy/stack-migrate.sh export ./backups/stack-move
  ./deploy/stack-migrate.sh import ./backups/stack-move --yes --create-db

EOF
}

log() { printf '\033[1;34m==>\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33m!!>\033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31mERR>\033[0m %s\n' "$*" >&2; }

default_bundle_dir() {
  local stamp
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  mkdir -p "$DEFAULT_BACKUP_DIR"
  printf '%s/stack-%s' "$DEFAULT_BACKUP_DIR" "$stamp"
}

write_stack_manifest() {
  local bundle="$1"
  python3 - "$bundle" "$LINKLOOM_DB" "$FOLO_DB" "${FROM_URL:-}" "${TO_URL:-}" "${APPEND_MODE:-0}" <<'PY'
import json, os, re, sys
from datetime import datetime, timezone

bundle, linkloom_db, folo_db = sys.argv[1:4]
src = sys.argv[4] if len(sys.argv) > 4 else ""
dst = sys.argv[5] if len(sys.argv) > 5 else ""
append = sys.argv[6] == "1" if len(sys.argv) > 6 else False

def mask(url: str) -> str:
    if not url:
        return ""
    return re.sub(r"(://)([^:@/]+):([^@/]+)@", r"\1***:***@", url, count=1)

payload = {
    "kind": "linkloom-folo-stack",
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "importMode": "append" if append else "replace",
    "databases": {
        "linkloom": {"file": "linkloom.dump", "db": linkloom_db},
        "folo": {"file": "folo.dump", "db": folo_db},
    },
    "source": mask(src),
    "target": mask(dst),
}
with open(os.path.join(bundle, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
PY
}

load_stack_manifest_mode() {
  local bundle="$1"
  local manifest="${bundle}/manifest.json"
  [[ -f "$manifest" ]] || return 0
  if [[ "${IMPORT_MODE_EXPLICIT:-}" == "1" ]]; then
    return 0
  fi
  local mode
  mode="$(python3 - "$manifest" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    print(json.load(f).get("importMode", "replace"))
PY
)"
  if [[ "$mode" == "append" ]]; then
    APPEND_MODE=1
    log "迁移包 importMode=append，使用追加导入"
  fi
}

verify_bundle() {
  local bundle="$1"
  if [[ ! -d "$bundle" ]]; then
    err "找不到迁移包目录: ${bundle}"
    exit 1
  fi
  if [[ ! -f "$bundle/linkloom.dump" ]]; then
    err "缺少 ${bundle}/linkloom.dump"
    exit 1
  fi
  if [[ ! -f "$bundle/folo.dump" ]]; then
    err "缺少 ${bundle}/folo.dump"
    exit 1
  fi
}

run_pg() {
  env "$@" bash "$PG_MIGRATE" "${PG_ARGS[@]}"
}

cmd_export() {
  local bundle="${1:-}"
  if [[ -z "$bundle" ]]; then
    bundle="$(default_bundle_dir)"
  fi
  mkdir -p "$bundle"

  log "整栈导出 → ${bundle}"
  log "  库: ${LINKLOOM_DB} + ${FOLO_DB}"
  log "  模式: $([[ "${APPEND_MODE:-}" == "1" ]] && printf '追加（仅数据）' || printf '覆盖（schema+数据）')"

  PG_ARGS=(export "${bundle}/linkloom.dump" --format archive)
  [[ "${APPEND_MODE:-}" == "1" ]] && PG_ARGS+=(--append)
  [[ -n "${FROM_URL:-}" ]] && PG_ARGS=(--from-url "$FROM_URL" "${PG_ARGS[@]}")
  SRC_POSTGRES_DB="$LINKLOOM_DB" run_pg

  PG_ARGS=(export "${bundle}/folo.dump" --format archive)
  [[ "${APPEND_MODE:-}" == "1" ]] && PG_ARGS+=(--append)
  SRC_POSTGRES_DB="$FOLO_DB" run_pg

  write_stack_manifest "$bundle"

  log "导出完成。"
  echo ""
  echo "  迁移包: ${bundle}/"
  echo "    linkloom.dump"
  echo "    folo.dump"
  echo "    manifest.json  (importMode: $([[ "${APPEND_MODE:-}" == "1" ]] && echo append || echo replace))"
  echo ""
  local import_flags="--yes"
  [[ "${APPEND_MODE:-}" == "1" ]] && import_flags+=" --append" || import_flags+=" --create-db"
  echo "  拷贝到目标设备后执行:"
  echo "    ./deploy/stack-migrate.sh import \"${bundle}\" ${import_flags}"
}

cmd_import() {
  local bundle="$1"
  verify_bundle "$bundle"
  load_stack_manifest_mode "$bundle"

  log "整栈导入 ← ${bundle}"
  log "  库: ${LINKLOOM_DB} + ${FOLO_DB}"
  log "  模式: $([[ "${APPEND_MODE:-}" == "1" ]] && printf '追加' || printf '覆盖')"

  local extra=()
  [[ "${ASSUME_YES:-}" == "1" ]] && extra+=(--yes)
  [[ "${CREATE_DB:-}" == "1" && "${APPEND_MODE:-}" != "1" ]] && extra+=(--create-db)
  [[ "${APPEND_MODE:-}" == "1" ]] && extra+=(--append)
  [[ "${IMPORT_MODE_EXPLICIT:-}" == "1" && "${APPEND_MODE:-}" != "1" ]] && extra+=(--replace)

  PG_ARGS=(import "${bundle}/linkloom.dump" "${extra[@]}")
  [[ -n "${TO_URL:-}" ]] && PG_ARGS=(--to-url "$TO_URL" "${PG_ARGS[@]}")
  DST_POSTGRES_DB="$LINKLOOM_DB" run_pg

  PG_ARGS=(import "${bundle}/folo.dump" "${extra[@]}")
  [[ -n "${TO_URL:-}" ]] && PG_ARGS=(--to-url "$TO_URL" "${PG_ARGS[@]}")
  DST_POSTGRES_DB="$FOLO_DB" run_pg

  log "整栈导入完成。"
  echo ""
  echo "  下一步:"
  echo "    1. 启动 LinkLoom: ./deploy/docker-deploy.sh --no-build"
  echo "    2. 启动 LocalFolo: 在 LocalFolo 目录 ./deploy/docker-deploy.sh --no-build"
  echo "    3. LinkLoom 文件资产（data/）若需迁移，请单独拷贝或使用 pnpm run backup:data"
}

parse_options() {
  ASSUME_YES=0
  CREATE_DB=0
  APPEND_MODE=0
  IMPORT_MODE_EXPLICIT=0
  FROM_URL=""
  TO_URL=""
  POSITIONAL=()

  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi

  case "${1:-}" in
    -h | --help)
      usage
      exit 0
      ;;
    export | import | bundle)
      COMMAND="$1"
      shift
      ;;
    *)
      err "未知命令: $1"
      usage
      exit 1
      ;;
  esac

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --yes)
        ASSUME_YES=1
        shift
        ;;
      --create-db)
        CREATE_DB=1
        shift
        ;;
      --append)
        APPEND_MODE=1
        IMPORT_MODE_EXPLICIT=1
        shift
        ;;
      --replace)
        APPEND_MODE=0
        IMPORT_MODE_EXPLICIT=1
        shift
        ;;
      --from-url)
        FROM_URL="${2:-}"
        shift 2
        ;;
      --to-url)
        TO_URL="${2:-}"
        shift 2
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        POSITIONAL+=("$1")
        shift
        ;;
    esac
  done
}

main() {
  if [[ ! -x "$PG_MIGRATE" ]]; then
    err "未找到 ${PG_MIGRATE}"
    exit 1
  fi

  cd "$ROOT"
  parse_options "$@"

  case "${COMMAND:-}" in
    export | bundle)
      cmd_export "${POSITIONAL[0]:-}"
      ;;
    import)
      if [[ ${#POSITIONAL[@]} -lt 1 ]]; then
        err "import 需要指定迁移包目录。"
        usage
        exit 1
      fi
      cmd_import "${POSITIONAL[0]}"
      ;;
  esac
}

main "$@"
