FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
RUN npm run build -w backend
WORKDIR /app/backend
ENV NODE_ENV=production
USER node
CMD ["sh","-c","npm run db:migrate && npm run db:seed && npm start"]
