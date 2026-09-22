FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages ./packages
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/web ./apps/web
ARG VITE_GRAPHQL_ENDPOINT
ARG VITE_RENDER_ENDPOINT
RUN pnpm --filter @resume-studio/web build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
