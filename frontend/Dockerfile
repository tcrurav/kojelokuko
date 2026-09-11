FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend frontend
RUN npm run build -w frontend
FROM caddy:2-alpine
COPY --from=build /app/frontend/dist /srv
COPY caddy/Caddyfile /etc/caddy/Caddyfile
