# ================================
# Stage 1: Base dependencies
# ================================
FROM node:20-alpine AS base

# Install runtime and development dependencies
RUN apk add --no-cache \
    openssl \
    docker-cli \
    docker-cli-compose \
    bash \
    postgresql-client \
    curl \
    git

WORKDIR /app

# ================================
# Stage 2: Dependencies
# ================================
FROM base AS deps

# Copy package files for caching
COPY package.json package-lock.json* ./

# Install all dependencies (for development and testing)
RUN npm ci

# ================================
# Stage 3: Build
# ================================
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js application
RUN npm run build

# ================================
# Stage 4: Production image
# ================================
FROM base AS production

# Copy only production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./

# Make start script executable
RUN chmod +x scripts/start.sh

EXPOSE 3000

# Default to production mode
ENV NODE_ENV=production

CMD ["./scripts/start.sh"]

# ================================
# Development target (build with: docker build --target development -t gitkata:dev .)
# ================================
FROM base AS development

# Copy all dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code for volume mounts
COPY . .

# Make start script executable
RUN chmod +x scripts/start.sh

EXPOSE 3000

ENV NODE_ENV=development

CMD ["./scripts/start.sh"]
