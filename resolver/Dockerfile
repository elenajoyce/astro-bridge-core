# Stage 1: Build
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy root monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/sdk/package.json ./packages/sdk/
COPY resolver/package.json ./resolver/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/config/ ./packages/config/
COPY packages/sdk/ ./packages/sdk/
COPY resolver/ ./resolver/

# Build code
RUN pnpm --filter @astro-bridge/config build
RUN pnpm --filter @astro-bridge/sdk build
RUN pnpm --filter @astro-bridge/resolver build

# Stage 2: Production Runner
FROM node:22-slim

WORKDIR /app

RUN npm install -g pnpm

# Copy workspace assets from builder
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/
COPY --from=builder /app/packages/config /app/packages/config
COPY --from=builder /app/packages/sdk /app/packages/sdk
COPY --from=builder /app/resolver /app/resolver

# Install production only dependencies
RUN pnpm install --prod

WORKDIR /app/resolver

ENTRYPOINT ["node", "dist/index.js"]
