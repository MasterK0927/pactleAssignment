# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Set environment for production runtime
ENV NODE_ENV=production

# Install required system packages
RUN apk add --no-cache curl postgresql-client bash

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including dev dependencies for build
RUN npm ci --include=dev

# Copy source code
COPY src/ ./src/
COPY data/ ./data/
COPY scripts/ ./scripts/
COPY database/ ./database/

# Build the application (ensure TypeScript is available)
RUN npx tsc

# Prune dev dependencies to reduce final image size
RUN npm prune --production

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application via entrypoint (wait for DB, run migrations, then start)
CMD ["./docker-entrypoint.sh"]
