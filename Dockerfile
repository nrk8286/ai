# --- Build Stage ---
FROM node:lts-alpine AS builder

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy app source
COPY . .

# Build the app (uncomment if using Next.js or similar)
RUN if [ -f next.config.js ] || [ -f next.config.ts ]; then pnpm run build; fi

# --- Production Stage ---
FROM node:lts-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy only necessary files from builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/public ./public
# Copy build output (for Next.js)
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/next.config.js ./next.config.js

# Use non-root user for security
RUN addgroup -g 1001 -S nodegroup && adduser -S nodeuser -G nodegroup
USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["npm", "start"]
