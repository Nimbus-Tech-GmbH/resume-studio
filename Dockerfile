# ── Base: install all deps ────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/render-service/package.json apps/render-service/
COPY apps/web/package.json apps/web/
COPY packages ./packages
RUN corepack enable && pnpm install --frozen-lockfile

# ── Render: build render-service ──────────────────────────────────
FROM base AS render-build
COPY apps/render-service ./apps/render-service
RUN pnpm --filter @resume-studio/render-service build

# ── Web: build SPA ────────────────────────────────────────────────
FROM base AS web-build
COPY apps/web ./apps/web
COPY packages/themes ./packages/themes
RUN pnpm --filter @resume-studio/web build

# ── Final: render-service + web static files ──────────────────────
FROM node:20-alpine
WORKDIR /app
COPY --from=render-build /app/apps/render-service/dist ./dist
COPY --from=web-build /app/apps/web/dist ./web-dist
EXPOSE 8787
CMD ["node", "dist/server.js"]
