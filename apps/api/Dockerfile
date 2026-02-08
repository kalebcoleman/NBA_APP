# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only dependency manifests first for caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/api/package.json apps/api/package.json

# Enable corepack (pnpm) in the build image
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

# Install workspace deps
COPY apps ./apps
COPY packages ./packages
COPY db ./db
COPY docs ./docs
RUN pnpm -w install --frozen-lockfile --filter @nba-app/api...

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

COPY --from=deps /app /app

# Build API + generate prisma client
RUN pnpm -w --filter @nba-app/api prisma:generate
RUN pnpm -w --filter @nba-app/api build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL=/tmp/nba.sqlite
ENV DATABASE_PATH=/tmp/nba.sqlite

# Copy only what we need to run
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules ./node_modules

# Bake sqlite into image (MVP)
# Adjust if your backend expects a specific path
COPY --from=builder /app/db/local/nba.sqlite ./db/nba.sqlite

EXPOSE 8080

CMD ["sh", "-c", "cp -f /app/db/nba.sqlite /tmp/nba.sqlite && chmod 666 /tmp/nba.sqlite && node apps/api/dist/src/index.js"]
