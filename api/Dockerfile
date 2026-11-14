FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=optional
COPY tsconfig.json vitest.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

