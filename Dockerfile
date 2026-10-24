# Contexto de build: la raíz de este repositorio.
FROM node:24-alpine AS build
WORKDIR /src
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# La API se sirve en el mismo origen (Nginx reenvía /api al contenedor de la API): las llamadas son relativas.
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY --from=build /src/dist/ /usr/share/nginx/html/
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["nginx", "-g", "daemon off;"]
