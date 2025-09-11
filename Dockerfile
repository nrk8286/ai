# --- Build Stage ---
FROM node:lts-alpine AS builder

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy app source and configuration files
COPY . .

# Set environment variables for build
ENV DATABASE_URL="file:./db.sqlite"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="build-secret-key"

# Build the app
RUN pnpm build

# --- Production Stage ---
FROM node:lts-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install pnpm and curl for health check
RUN npm install -g pnpm && \
    apk add --no-cache curl

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy build output and necessary files from builder
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/next.config.ts ./next.config.ts
COPY --from=builder /usr/src/app/db.sqlite ./db.sqlite

# Use non-root user for security
RUN addgroup -g 1001 -S nodegroup && \
    adduser -S nodeuser -u 1001 -G nodegroup && \
    chown -R nodeuser:nodegroup /usr/src/app

USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["pnpm", "start"]
