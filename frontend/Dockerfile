FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

ARG VITE_PUBLIC_SITE_URL=http://localhost:8080
ARG NEXUS_PUBLIC_URL=http://localhost:8080
ARG VITE_APP_VERSION=0.1.0-local

ENV VITE_PUBLIC_SITE_URL=${VITE_PUBLIC_SITE_URL}
ENV NEXUS_PUBLIC_URL=${NEXUS_PUBLIC_URL}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}

RUN npm run build


FROM nginx:1.28-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK \
  --interval=10s \
  --timeout=3s \
  --start-period=10s \
  --retries=5 \
  CMD wget --quiet --spider http://127.0.0.1:8080/ || exit 1