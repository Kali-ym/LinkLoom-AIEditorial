#!/usr/bin/env bash
# PostgreSQL 整库导出、导入与一键迁移（pg_dump / psql）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.env"
COMPOSE_FILE="${ROOT}/deploy/docker/compose.yml"
DEFAULT_BACKUP_DIR="${ROOT}/backups"

usage() {
  cat <<'EOF'
用法: ./deploy/postgres-migrate.sh <命令> [选项] [参数]

命令:
  export [路径]     从源库导出全部 schema + 数据
  import <路径>     将导出文件导入目标库
  migrate [路径]    导出源库后立即导入目标库（默认压缩单文件，适合大库）

选项:
  --yes             导入前不交互确认
  --create-db       目标库不存在时自动创建（连 postgres 库执行 CREATE DATABASE）
  --format plain    文本 SQL（import 用 psql；可加 --gzip 得 .sql.gz）
  --format archive  压缩单文件（pg_dump -Fc，默认用于 migrate）
  --format custom   目录格式（pg_dump -Fd，大库可并行 restore）
  --gzip            与 plain 联用：导出 .sql.gz，import 自动识别 .gz
  --append          追加模式：仅导出/导入数据，不 DROP 目标库已有对象；主键冲突行跳过
  --replace         覆盖模式（import 默认）：先 DROP 再重建（与 --append 互斥）
  --from-url URL    源库连接串（覆盖 SRC_* / .env）
  --to-url URL      目标库连接串（覆盖 DST_* / .env）
  --help            显示本帮助

连接配置（优先级：命令行 URL > 带前缀环境变量 > .env）:
  源库（export / migrate）:
    SRC_DATABASE_URL  或 SRC_POSTGRES_{HOST,PORT,USER,PASSWORD,DB}
  目标库（import / migrate）:
    DST_DATABASE_URL  或 DST_POSTGRES_{HOST,PORT,USER,PASSWORD,DB}
  未设置 SRC_/DST_ 时，回退到 .env 中的 DATABASE_URL / POSTGRES_*

示例:
  # 备份当前 .env 指向的库
  ./deploy/postgres-migrate.sh export

  # 指定输出文件
  ./deploy/postgres-migrate.sh export ./backups/linkloom-full.sql

  # 恢复到 .env 中的库
  ./deploy/postgres-migrate.sh import ./backups/linkloom-full.dump --yes

  # 跨主机单库（LinkLoom + LocalFolo 一起迁请用 stack-migrate.sh）
  SRC_DATABASE_URL=postgres://u:p@old.host:5432/linkloom \
  DST_DATABASE_URL=postgres://u:p@new.host:5432/linkloom \
    ./deploy/postgres-migrate.sh migrate --yes --create-db

依赖: 本机 pg_dump/psql，或运行中的 docker compose postgres 服务。
EOF
}

log() { printf '\033[1;34m==>\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33m!!>\033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31mERR>\033[0m %s\n' "$*" >&2; }

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
  fi
}

pg_prefixed() {
  local prefix="$1"
  local key="$2"
  local fallback="${3:-}"
  local name="${prefix}${key}"
  if [[ -n "${!name:-}" ]]; then
    printf '%s' "${!name}"
  else
    printf '%s' "$fallback"
  fi
}

mask_url() {
  printf '%s' "$1" | sed -E 's#(://)[^:@/]+:[^@/]+@#\1***:***@#'
}

resolve_database_url() {
  local prefix="$1"
  local override_url="${2:-}"

  if [[ -n "$override_url" ]]; then
    printf '%s' "$override_url"
    return 0
  fi

  local direct
  direct="$(pg_prefixed "$prefix" "DATABASE_URL" "")"
  if [[ -n "$direct" ]]; then
    printf '%s' "$direct"
    return 0
  fi

  local user password host port db
  user="$(pg_prefixed "$prefix" "POSTGRES_USER" "$(pg_prefixed "" "POSTGRES_USER" "linkloom")")"
  password="$(pg_prefixed "$prefix" "POSTGRES_PASSWORD" "$(pg_prefixed "" "POSTGRES_PASSWORD" "linkloom")")"
  host="$(pg_prefixed "$prefix" "POSTGRES_HOST" "$(pg_prefixed "" "POSTGRES_HOST" "localhost")")"
  port="$(pg_prefixed "$prefix" "POSTGRES_PORT" "$(pg_prefixed "" "POSTGRES_PORT" "5432")")"
  db="$(pg_prefixed "$prefix" "POSTGRES_DB" "$(pg_prefixed "" "POSTGRES_DB" "linkloom")")"

  if [[ -z "$user" || -z "$password" || -z "$db" ]]; then
    err "缺少 ${prefix}DATABASE_URL 或 ${prefix}POSTGRES_* / POSTGRES_* 配置。"
    return 1
  fi

  PG_MIGRATE_USER="$user" PG_MIGRATE_PASSWORD="$password" PG_MIGRATE_HOST="$host" \
    PG_MIGRATE_PORT="$port" PG_MIGRATE_DB="$db" \
    python3 - <<'PY'
import os, urllib.parse
user = os.environ["PG_MIGRATE_USER"]
password = os.environ["PG_MIGRATE_PASSWORD"]
host = os.environ["PG_MIGRATE_HOST"]
port = os.environ["PG_MIGRATE_PORT"]
db = os.environ["PG_MIGRATE_DB"]
print(
    "postgres://"
    f"{urllib.parse.quote(user, safe='')}:{urllib.parse.quote(password, safe='')}"
    f"@{host}:{port}/{urllib.parse.quote(db, safe='')}"
)
PY
}

resolve_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose -f "$COMPOSE_FILE")
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose -f "$COMPOSE_FILE")
  else
    COMPOSE=()
  fi
}

compose_postgres_running() {
  [[ ${#COMPOSE[@]} -gt 0 ]] || return 1
  "${COMPOSE[@]}" ps --status running postgres 2>/dev/null | grep -q postgres
}

url_host() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
print(urlparse(sys.argv[1]).hostname or "localhost")
PY
}

url_port() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
p = urlparse(sys.argv[1])
print(p.port or 5432)
PY
}

url_user() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse, unquote
p = urlparse(sys.argv[1])
print(unquote(p.username or "postgres"))
PY
}

url_password() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse, unquote
p = urlparse(sys.argv[1])
print(unquote(p.password or ""))
PY
}

url_dbname() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
p = urlparse(sys.argv[1])
name = (p.path or "/").lstrip("/")
print(name.split("?", 1)[0] or "postgres")
PY
}

export_pg_env() {
  local url="$1"
  export PGHOST="$(url_host "$url")"
  export PGPORT="$(url_port "$url")"
  export PGUSER="$(url_user "$url")"
  export PGPASSWORD="$(url_password "$url")"
  export PGDATABASE="$(url_dbname "$url")"
}

pg_client_mode() {
  local url="${1:-}"
  local host=""
  if [[ -n "$url" ]]; then
    host="$(url_host "$url")"
  fi

  if command -v pg_dump >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
    printf 'local'
    return 0
  fi

  if compose_postgres_running \
    && { [[ -z "$host" ]] || [[ "$host" == "postgres" ]] || [[ "$host" == "localhost" ]] || [[ "$host" == "127.0.0.1" ]]; }; then
    printf 'compose'
    return 0
  fi

  printf 'none'
}

pg_dump_mode_flags() {
  if [[ "${APPEND_MODE:-}" == "1" ]]; then
    printf '%s' '--data-only'
  else
    printf '%s' '--clean --if-exists'
  fi
}

pg_restore_mode_flags() {
  if [[ "${APPEND_MODE:-}" == "1" ]]; then
    printf '%s' '--data-only --disable-triggers'
  else
    printf '%s' '--clean --if-exists'
  fi
}

run_pg_dump() {
  local url="$1"
  local format="$2"
  local output="$3"
  local mode dump_flags
  mode="$(pg_client_mode "$url")"
  dump_flags="$(pg_dump_mode_flags)"

  case "$mode" in
    local)
      export_pg_env "$url"
      case "$format" in
        custom)
          mkdir -p "$output"
          # shellcheck disable=SC2086
          pg_dump --no-owner --no-privileges $dump_flags --format=directory --file="$output"
          ;;
        archive)
          # shellcheck disable=SC2086
          pg_dump --no-owner --no-privileges $dump_flags --format=custom --file="$output" --dbname="$url"
          ;;
        plain)
          if [[ "${USE_GZIP:-}" == "1" ]]; then
            # shellcheck disable=SC2086
            pg_dump --no-owner --no-privileges $dump_flags --format=plain --dbname="$url" | gzip -c >"$output"
          else
            # shellcheck disable=SC2086
            pg_dump --no-owner --no-privileges $dump_flags --format=plain --dbname="$url" >"$output"
          fi
          ;;
      esac
      ;;
    compose)
      case "$format" in
        custom)
          err "compose 模式暂不支持 --format custom，请安装本机 postgresql-client。"
          return 1
          ;;
        archive)
          log "使用 compose postgres 容器执行 pg_dump（压缩 archive）…"
          # shellcheck disable=SC2086
          "${COMPOSE[@]}" exec -T postgres \
            pg_dump -U "$(url_user "$url")" --no-owner --no-privileges $dump_flags --format=custom "$(url_dbname "$url")" \
            >"$output"
          ;;
        plain)
          log "使用 compose postgres 容器执行 pg_dump …"
          if [[ "${USE_GZIP:-}" == "1" ]]; then
            # shellcheck disable=SC2086
            "${COMPOSE[@]}" exec -T postgres \
              pg_dump -U "$(url_user "$url")" --no-owner --no-privileges $dump_flags --format=plain "$(url_dbname "$url")" \
              | gzip -c >"$output"
          else
            # shellcheck disable=SC2086
            "${COMPOSE[@]}" exec -T postgres \
              pg_dump -U "$(url_user "$url")" --no-owner --no-privileges $dump_flags --format=plain "$(url_dbname "$url")" \
              >"$output"
          fi
          ;;
      esac
      ;;
    none)
      err "未找到 pg_dump/psql，且 compose postgres 未运行。"
      err "请安装 postgresql-client，或先执行 ./deploy/docker-deploy.sh 启动 postgres。"
      return 1
      ;;
  esac
}

run_psql_stream() {
  local url="$1"
  local on_error_stop="${2:-1}"
  local mode
  mode="$(pg_client_mode "$url")"

  case "$mode" in
    local)
      psql "$url" -v ON_ERROR_STOP="$on_error_stop"
      ;;
    compose)
      log "使用 compose postgres 容器执行 psql …"
      "${COMPOSE[@]}" exec -T postgres \
        psql -U "$(url_user "$url")" -v ON_ERROR_STOP="$on_error_stop" -d "$(url_dbname "$url")"
      ;;
    none)
      err "未找到 psql，且 compose postgres 未运行。"
      return 1
      ;;
  esac
}

run_psql_file() {
  local url="$1"
  local input="$2"
  local on_error_stop=1
  [[ "${APPEND_MODE:-}" == "1" ]] && on_error_stop=0

  if [[ "$input" == *.gz ]]; then
    gzip -dc "$input" | run_psql_stream "$url" "$on_error_stop"
    return
  fi

  local mode
  mode="$(pg_client_mode "$url")"

  case "$mode" in
    local)
      psql "$url" -v ON_ERROR_STOP="$on_error_stop" -f "$input"
      ;;
    compose)
      log "使用 compose postgres 容器执行 psql …"
      "${COMPOSE[@]}" exec -T postgres \
        psql -U "$(url_user "$url")" -v ON_ERROR_STOP="$on_error_stop" -d "$(url_dbname "$url")" <"$input"
      ;;
    none)
      err "未找到 psql，且 compose postgres 未运行。"
      return 1
      ;;
  esac
}

run_pg_restore() {
  local url="$1"
  local input="$2"
  local mode restore_flags
  mode="$(pg_client_mode "$url")"
  restore_flags="$(pg_restore_mode_flags)"

  case "$mode" in
    local)
      export_pg_env "$url"
      # shellcheck disable=SC2086
      pg_restore --no-owner --no-privileges $restore_flags --dbname="$url" "$input"
      ;;
    compose)
      log "使用 compose postgres 容器执行 pg_restore …"
      if [[ -d "$input" ]]; then
        err "compose 模式暂不支持 pg_restore 目录格式，请安装本机 postgresql-client。"
        return 1
      fi
      # shellcheck disable=SC2086
      "${COMPOSE[@]}" exec -T postgres \
        pg_restore -U "$(url_user "$url")" --no-owner --no-privileges $restore_flags -d "$(url_dbname "$url")" \
        <"$input"
      ;;
    none)
      err "未找到 pg_restore，且 compose postgres 未运行。"
      return 1
      ;;
  esac
}

admin_database_url() {
  local url="$1"
  python3 - "$url" <<'PY'
import sys
from urllib.parse import urlparse, urlunparse
p = urlparse(sys.argv[1])
admin = p._replace(path="/postgres")
print(urlunparse(admin))
PY
}

ensure_target_database() {
  local url="$1"
  local mode db admin_url
  db="$(url_dbname "$url")"
  admin_url="$(admin_database_url "$url")"
  mode="$(pg_client_mode "$url")"

  local exists
  case "$mode" in
    local)
      exists="$(psql "$admin_url" -tAc "SELECT 1 FROM pg_database WHERE datname = '${db}'" 2>/dev/null || true)"
      ;;
    compose)
      exists="$("${COMPOSE[@]}" exec -T postgres \
        psql -U "$(url_user "$url")" -tAc "SELECT 1 FROM pg_database WHERE datname = '${db}'" 2>/dev/null || true)"
      ;;
    *)
      return 1
      ;;
  esac

  if [[ "$exists" == "1" ]]; then
    log "目标库已存在: ${db}"
    return 0
  fi

  log "创建目标库: ${db}"
  case "$mode" in
    local)
      psql "$admin_url" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${db}\" OWNER \"$(url_user "$url")\";"
      ;;
    compose)
      "${COMPOSE[@]}" exec -T postgres \
        psql -U "$(url_user "$url")" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${db}\" OWNER \"$(url_user "$url")\";"
      ;;
  esac
}

default_export_path() {
  local format="$1"
  local stamp
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  mkdir -p "$DEFAULT_BACKUP_DIR"
  case "$format" in
    custom)
      printf '%s/pg-export-%s.dir' "$DEFAULT_BACKUP_DIR" "$stamp"
      ;;
    archive)
      printf '%s/pg-export-%s.dump' "$DEFAULT_BACKUP_DIR" "$stamp"
      ;;
    plain)
      if [[ "${USE_GZIP:-}" == "1" ]]; then
        printf '%s/pg-export-%s.sql.gz' "$DEFAULT_BACKUP_DIR" "$stamp"
      else
        printf '%s/pg-export-%s.sql' "$DEFAULT_BACKUP_DIR" "$stamp"
      fi
      ;;
  esac
}

ensure_export_suffix() {
  local output="$1"
  local format="$2"

  case "$format" in
    archive)
      if [[ "$output" == *.dump || "$output" == *.backup ]]; then
        printf '%s' "$output"
      else
        printf '%s.dump' "$output"
      fi
      ;;
    plain)
      if [[ "${USE_GZIP:-}" == "1" ]]; then
        if [[ "$output" == *.gz ]]; then
          printf '%s' "$output"
        elif [[ "$output" == *.sql ]]; then
          printf '%s.gz' "$output"
        else
          printf '%s.sql.gz' "$output"
        fi
      elif [[ "$output" == *.sql || "$output" == *.gz ]]; then
        printf '%s' "$output"
      else
        printf '%s.sql' "$output"
      fi
      ;;
    *)
      printf '%s' "$output"
      ;;
  esac
}

write_manifest() {
  local manifest="$1"
  local src_url="$2"
  local dst_url="${3:-}"
  local format="$4"
  local artifact="$5"

  PG_MIGRATE_MANIFEST="$manifest" PG_MIGRATE_SRC="$src_url" PG_MIGRATE_DST="$dst_url" \
    PG_MIGRATE_FORMAT="$format" PG_MIGRATE_ARTIFACT="$artifact" \
    PG_MIGRATE_GZIP="${USE_GZIP:-0}" PG_MIGRATE_APPEND="${APPEND_MODE:-0}" \
    python3 - <<'PY'
import json, os, re
from datetime import datetime, timezone

def mask(url: str) -> str:
    return re.sub(r"(://)([^:@/]+):([^@/]+)@", r"\1***:***@", url, count=1)

manifest = os.environ["PG_MIGRATE_MANIFEST"]
payload = {
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "format": os.environ["PG_MIGRATE_FORMAT"],
    "artifact": os.environ["PG_MIGRATE_ARTIFACT"],
    "source": mask(os.environ["PG_MIGRATE_SRC"]),
    "gzip": os.environ.get("PG_MIGRATE_GZIP") == "1",
    "importMode": "append" if os.environ.get("PG_MIGRATE_APPEND") == "1" else "replace",
}
dst = os.environ.get("PG_MIGRATE_DST", "")
if dst:
    payload["target"] = mask(dst)
with open(manifest, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
PY
}

confirm_import() {
  local dst_url="$1"
  if [[ "${ASSUME_YES:-}" == "1" ]]; then
    return 0
  fi
  warn "将把数据导入: $(mask_url "$dst_url")"
  if [[ "${APPEND_MODE:-}" == "1" ]]; then
    warn "追加模式：不 DROP 已有表/数据；主键/唯一约束冲突的行会跳过。"
    warn "请确保目标库 schema 已与源库一致（应用已启动并完成迁移）。"
  else
    warn "覆盖模式：dump 含 --clean --if-exists，目标库同名对象会被删除后重建。"
  fi
  read -r -p "确认继续？[y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

cmd_export() {
  local output="${1:-}"
  local src_url
  src_url="$(resolve_database_url "SRC_" "$FROM_URL")"

  if [[ -z "$output" ]]; then
    output="$(default_export_path "$DUMP_FORMAT")"
  else
    output="$(ensure_export_suffix "$output" "$DUMP_FORMAT")"
  fi
  mkdir -p "$(dirname "$output")"

  log "导出源库: $(mask_url "$src_url")"
  log "模式: $([[ "${APPEND_MODE:-}" == "1" ]] && printf '追加（仅数据）' || printf '覆盖（schema+数据）')"
  log "格式: ${DUMP_FORMAT}$([[ "${USE_GZIP:-}" == "1" ]] && printf ' + gzip' || true)"
  log "输出: ${output}"
  run_pg_dump "$src_url" "$DUMP_FORMAT" "$output"

  local manifest
  if [[ "$DUMP_FORMAT" == "custom" ]]; then
    manifest="${output%/}/manifest.json"
  else
    manifest="${output}.manifest.json"
  fi
  write_manifest "$manifest" "$src_url" "" "$DUMP_FORMAT" "$output"

  log "导出完成。"
  echo ""
  echo "  数据文件: ${output}"
  echo "  清单文件: ${manifest}"
  if [[ -f "$output" ]]; then
    echo "  文件大小: $(du -h "$output" | awk '{print $1}')"
  fi
  echo ""
  echo "  导入示例: ./deploy/postgres-migrate.sh import \"${output}\" --yes"
}

resolve_import_path() {
  local input="$1"
  if [[ -f "$input" ]]; then
    printf '%s' "$input"
    return 0
  fi
  if [[ -d "$input" && -f "$input/manifest.json" ]]; then
    printf '%s' "$input"
    return 0
  fi
  err "找不到导出文件或目录: ${input}"
  return 1
}

detect_import_format() {
  local input="$1"

  if [[ -d "$input" ]]; then
    printf 'custom'
    return 0
  fi

  if [[ "$input" == *.gz ]]; then
    printf 'plain'
    return 0
  fi

  if [[ "$input" == *.dump || "$input" == *.backup ]]; then
    printf 'archive'
    return 0
  fi

  if [[ -f "${input}.manifest.json" ]]; then
    local manifest_format
    manifest_format="$(python3 - "${input}.manifest.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    print(json.load(f).get("format", "plain"))
PY
)"
    if [[ -n "$manifest_format" ]]; then
      printf '%s' "$manifest_format"
      return 0
    fi
  fi

  printf 'plain'
}

load_manifest_import_mode() {
  local input="$1"
  local manifest="${input}.manifest.json"
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
    log "检测到 manifest importMode=append，使用追加导入"
  fi
}

cmd_import() {
  local input="$1"
  local dst_url format
  dst_url="$(resolve_database_url "DST_" "$TO_URL")"
  input="$(resolve_import_path "$input")"
  load_manifest_import_mode "$input"
  format="$(detect_import_format "$input")"

  if ! confirm_import "$dst_url"; then
    err "已取消。"
    exit 1
  fi

  if [[ "${CREATE_DB:-}" == "1" ]]; then
    ensure_target_database "$dst_url"
  fi

  log "导入目标库: $(mask_url "$dst_url")"
  log "模式: $([[ "${APPEND_MODE:-}" == "1" ]] && printf '追加' || printf '覆盖')"
  case "$format" in
    custom | archive)
      run_pg_restore "$dst_url" "$input"
      ;;
    plain)
      run_psql_file "$dst_url" "$input"
      ;;
  esac

  log "导入完成。请重启依赖该库的应用后再对外服务。"
}

cmd_migrate() {
  local output="${1:-}"
  local src_url dst_url
  src_url="$(resolve_database_url "SRC_" "$FROM_URL")"
  dst_url="$(resolve_database_url "DST_" "$TO_URL")"

  if [[ "$src_url" == "$dst_url" ]]; then
    err "源库与目标库连接相同，请设置不同的 SRC_* / DST_* 或 --from-url / --to-url。"
    exit 1
  fi

  if [[ -z "$output" ]]; then
    output="$(default_export_path "$DUMP_FORMAT")"
  else
    output="$(ensure_export_suffix "$output" "$DUMP_FORMAT")"
  fi
  mkdir -p "$(dirname "$output")"

  log "一键迁移（格式: ${DUMP_FORMAT}）"
  log "  源: $(mask_url "$src_url")"
  log "  目标: $(mask_url "$dst_url")"

  FROM_URL="$src_url"
  cmd_export "$output"

  TO_URL="$dst_url"
  cmd_import "$output"
}

parse_global_options() {
  ASSUME_YES=0
  CREATE_DB=0
  USE_GZIP=0
  APPEND_MODE=0
  IMPORT_MODE_EXPLICIT=0
  DUMP_FORMAT=plain
  DUMP_FORMAT_EXPLICIT=0
  FROM_URL=""
  TO_URL=""
  POSITIONAL=()

  if [[ $# -eq 0 ]]; then
    err "缺少命令: export | import | migrate"
    usage
    exit 1
  fi

  case "${1:-}" in
    -h | --help)
      usage
      exit 0
      ;;
    export | import | migrate)
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
      --format)
        DUMP_FORMAT="${2:-}"
        DUMP_FORMAT_EXPLICIT=1
        if [[ "$DUMP_FORMAT" != "plain" && "$DUMP_FORMAT" != "archive" && "$DUMP_FORMAT" != "custom" ]]; then
          err "--format 仅支持 plain、archive 或 custom"
          exit 1
        fi
        shift 2
        ;;
      --gzip)
        USE_GZIP=1
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
  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi

  cd "$ROOT"
  load_env
  resolve_compose

  parse_global_options "$@"

  if [[ "$COMMAND" == "migrate" && "$DUMP_FORMAT_EXPLICIT" != "1" ]]; then
    DUMP_FORMAT=archive
  fi

  if [[ "${USE_GZIP:-}" == "1" && "$DUMP_FORMAT" != "plain" ]]; then
    err "--gzip 仅可与 --format plain 联用；migrate 默认已使用 archive 压缩单文件。"
    exit 1
  fi

  case "${COMMAND:-}" in
    export)
      cmd_export "${POSITIONAL[0]:-}"
      ;;
    import)
      if [[ ${#POSITIONAL[@]} -lt 1 ]]; then
        err "import 需要指定导出文件或目录路径。"
        usage
        exit 1
      fi
      cmd_import "${POSITIONAL[0]}"
      ;;
    migrate)
      cmd_migrate "${POSITIONAL[0]:-}"
      ;;
    *)
      err "未知命令: ${COMMAND:-}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
