FROM node:24.15-bookworm-slim AS deps-base
WORKDIR /app

# Override at build time if mirrors are slow/unavailable:
#   docker compose build --build-arg APT_MIRROR=deb.debian.org --build-arg NPM_REGISTRY=https://registry.npmjs.org
ARG APT_MIRROR=mirrors.aliyun.com
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
ENV npm_config_registry=${NPM_REGISTRY}

# pg is pure JS — no native toolchain needed; only sharp requires build tools.
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list; \
    fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# Node 24+ 可直接安装 pnpm 11；走 npm registry，避免 corepack prepare 在 Docker 网络下单独下载失败。
RUN npm config set registry "${NPM_REGISTRY}" \
  && npm install -g pnpm@11.5.1 \
  && pnpm --version

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY admin/package.json admin/package.json
COPY web/package.json web/package.json
COPY agent-console/package.json agent-console/package.json

# First install can take 10–20 min (Next.js + native builds). Use plain progress:
#   BUILDKIT_PROGRESS=plain docker compose -f deploy/docker/compose.yml build
FROM deps-base AS deps
RUN --mount=type=cache,id=linkloom-pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --reporter=append-only

FROM deps-base AS prod-deps
ENV CI=true
RUN --mount=type=cache,id=linkloom-pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --prod --reporter=append-only

FROM deps AS build
WORKDIR /app
# 构建参数由 compose / .env 传入（见 DOCKER_BUILD_PROFILE、DOCKER_BUILD_NODE_HEAP）
ARG BUILD_NODE_MAX_OLD_SPACE_SIZE=1280
ARG DOCKER_BUILD_PARALLEL=serial
ARG SKIP_APP_BUILD=0
ENV NODE_OPTIONS=--max-old-space-size=${BUILD_NODE_MAX_OLD_SPACE_SIZE}
# .env 被 .dockerignore 排除，前端 VITE_* 须通过 build-arg 注入（compose 从宿主机 .env 传入）
# agent-console 已独立托管，镜像不再构建 / 内嵌 /console/
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
COPY . .
RUN if [ "$SKIP_APP_BUILD" = "1" ]; then \
      echo ">> 使用宿主机预构建产物 + 容器内构建 web" \
      && test -d backend/dist \
      && test -f admin/dist/index.html \
      && pnpm --filter ./web run build; \
    elif [ "$DOCKER_BUILD_PARALLEL" = "parallel" ]; then \
      pnpm run build:backend \
      && pnpm exec turbo run build --filter=linkloom-admin --filter=linkloom-web --concurrency=2; \
    else \
      pnpm run build:backend \
      && pnpm --filter ./admin run build \
      && pnpm --filter ./web run build; \
    fi

FROM node:24.15-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

ARG APT_MIRROR=mirrors.aliyun.com

# Install postgresql-client for pg_dump / psql backup/restore
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list; \
    fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/admin/dist ./admin/dist
COPY --from=build /app/web/.next ./web/.next
COPY --from=build /app/web/package.json ./web/package.json
COPY --from=build /app/version ./version
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/index.js"]