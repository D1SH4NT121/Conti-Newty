# Dockerfile for Conti-Newty Workbench (Cloud Container Deployment)
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy application source
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Generate Prisma Client & compile TypeScript
RUN npx prisma generate
RUN npm run build

# Production Runner Image
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create directory for persistent workspaces
RUN mkdir -p /app/workspaces && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
