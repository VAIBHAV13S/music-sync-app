# Multi-stage build for production

# Build stage for client
FROM node:18-alpine AS client-builder
WORKDIR /app/client
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build:prod

# Build stage for server
FROM node:18-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ .
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S musicapp -u 1001

# Copy built server
COPY --from=server-builder /app/server/dist ./server/
COPY --from=server-builder /app/server/node_modules ./node_modules/
COPY --from=server-builder /app/server/package.json ./

# Copy built client (if serving static files)
COPY --from=client-builder /app/client/dist ./public/

# Set ownership
RUN chown -R musicapp:nodejs /app
USER musicapp

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3001

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:prod"]