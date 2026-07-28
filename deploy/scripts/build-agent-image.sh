#!/usr/bin/env bash
# 构建 Agent 沙箱 demo 镜像（linkloom-agent:demo）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="${LINKLOOM_AGENT_IMAGE:-linkloom-agent:demo}"
DOCKERFILE="${ROOT}/deploy/docker/agent/Dockerfile.demo"
CONTEXT="${ROOT}/deploy/docker/agent"

exec docker build -t "$IMAGE" -f "$DOCKERFILE" "$CONTEXT"
