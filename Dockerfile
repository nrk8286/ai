# --- Build Stage ---
FROM node:22-alpine AS builder

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /usr/src/app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.15.0 --activate \
    && pnpm install --frozen-lockfile --prod=false

# Copy app source
COPY . .

# Builds do not need database credentials or apply migrations.
RUN pnpm build

# --- Production Stage ---
FROM node:22-alpine

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /usr/src/app

# Copy only necessary files from builder
COPY --from=builder --chown=node:node /usr/src/app/package.json /usr/src/app/next.config.ts /usr/src/app/tsconfig.json /usr/src/app/drizzle.config.ts ./
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/public ./public
# Copy build output (for Next.js)
COPY --from=builder --chown=node:node /usr/src/app/.next ./.next
# Keep explicit migration/verification commands available in the image.
COPY --from=builder --chown=node:node /usr/src/app/lib/db ./lib/db

# Use non-root user for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=6 \
    CMD wget --quiet --tries=1 --output-document=/dev/null http://localhost:3000/api/auth/session || exit 1

CMD ["node", "node_modules/next/dist/bin/next", "start"]
