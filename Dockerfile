FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY prisma ./prisma/

RUN npm ci --include=optional
RUN cd apps/web && npm install --include=optional

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY apps/web ./apps/web
COPY prisma/migration.sql ./prisma/migration.sql

RUN npx prisma generate

RUN npm run build

FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Backend
COPY --from=builder /app/dist/src ./dist/src

# React/Vite frontend
COPY --from=builder /app/dist/client ./dist/client

# Existing static landing/public files
COPY --from=builder /app/public ./public

RUN mkdir -p /app/workspaces && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/src/server.js"]
