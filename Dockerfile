# ── Base: install all deps ────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/render-service/package.json apps/render-service/
COPY apps/web/package.json apps/web/
COPY apps/auth-service/package.json apps/auth-service/
COPY apps/ai-service/package.json apps/ai-service/
COPY packages ./packages
RUN corepack enable && pnpm install --frozen-lockfile

# ── Render: build render-service ──────────────────────────────────
FROM base AS render-build
COPY apps/render-service ./apps/render-service
RUN pnpm --filter @resume-studio/render-service build

# ── Web: build SPA ────────────────────────────────────────────────
FROM base AS web-build
ARG VITE_GRAPHQL_ENDPOINT
ARG VITE_RENDER_ENDPOINT
COPY apps/web ./apps/web
COPY packages/themes ./packages/themes
RUN pnpm --filter @resume-studio/web build

# ── Auth: deploy auth-service + deps ─────────────────────────────
FROM base AS auth-build
COPY apps/auth-service ./apps/auth-service
RUN pnpm --filter @resume-studio/auth-service deploy --legacy /app/auth-service

# ── AI: deploy ai-service + deps ─────────────────────────────────
FROM base AS ai-build
COPY apps/ai-service ./apps/ai-service
RUN pnpm --filter @resume-studio/ai-service deploy --legacy /app/ai-service

# ── Final: render-service + web static files + auth + ai ─────────
FROM node:20-alpine
WORKDIR /app
COPY --from=render-build /app/apps/render-service/dist ./dist
COPY --from=web-build /app/apps/web/dist ./web-dist
COPY --from=auth-build /app/auth-service ./auth-service
COPY --from=ai-build /app/ai-service ./ai-service
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 5173
# NOTE: auth-service and ai-service run from source via tsx, so `pnpm deploy`
# must keep devDependencies. Adding --prod to deploy above breaks startup.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
