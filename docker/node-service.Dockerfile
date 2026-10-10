# syntax=docker/dockerfile:1.7
# Shared image for Node services (api, worker). Build with --build-arg APP=api|worker.
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG APP
# Lockfile first so dependency download is cached independently of source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@wedding/${APP}..." --filter wedding-site
RUN pnpm --filter "@wedding/${APP}" build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter "@wedding/${APP}" deploy --legacy --prod /out \
 && cp -r "apps/${APP}/dist" /out/dist

FROM ${NODE_IMAGE} AS runtime
ARG APP
ARG APP_VERSION=dev
ENV NODE_ENV=production APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
CMD ["node", "--enable-source-maps", "dist/index.js"]
