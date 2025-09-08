# Multi-stage build for ZARA system
FROM node:18-alpine AS base

# Install system dependencies including SSL libraries for Prisma
RUN apk add --no-cache curl git openssl1.1-compat

# Set working directory
WORKDIR /app

# Copy root package.json if exists
COPY package*.json ./

# Copy server files
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

# Install server dependencies
WORKDIR /app/server
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Copy server source code
COPY server/ .

# Create necessary directories
RUN mkdir -p uploads/avatars uploads/images

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
CMD ["npm", "start"]