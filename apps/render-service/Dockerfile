FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/render-service/package.json apps/render-service/
COPY packages ./packages
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/render-service ./apps/render-service
RUN pnpm --filter @resume-studio/render-service build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app
EXPOSE 8787
CMD ["node", "--import", "./apps/render-service/dist/preload.js", "apps/render-service/dist/server.js"]
