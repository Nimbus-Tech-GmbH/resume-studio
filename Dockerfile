# ── Base ──────────────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./turbo.json 2>/dev/null || true

# ── Render: build web + render-service ───────────────────────────
FROM base AS render-build
COPY apps/web ./apps/web
COPY apps/render-service ./apps/render-service
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @resume-studio/web build
RUN pnpm --filter @resume-studio/render-service build

# ── Auth: deploy auth-service + deps ─────────────────────────────
FROM base AS auth-build
COPY apps/auth-service ./apps/auth-service
RUN pnpm --filter @resume-studio/auth-service db:generate
RUN pnpm --filter @resume-studio/auth-service deploy --legacy /app/auth-service

# ── AI: deploy ai-service + deps ─────────────────────────────────
FROM base AS ai-build
COPY apps/ai-service ./apps/ai-service
RUN pnpm --filter @resume-studio/ai-service deploy --legacy /app/ai-service

# ── Final: render-service + web static files + auth + ai ─────────
FROM node:20-alpine
WORKDIR /app
COPY --from=render-build /app/apps/render-service/dist ./dist
COPY --from=render-build /app/apps/web/dist ./public
COPY --from=auth-build /app/auth-service ./
COPY --from=ai-build /app/ai-service ./
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 5173
# NOTE: auth-service and ai-service run from source via tsx, so `pnpm deploy`
# must keep devDependencies. Adding --prod to deploy above breaks startup.
# Prisma 7 contract files must be present for db.ts to import them at runtime.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
