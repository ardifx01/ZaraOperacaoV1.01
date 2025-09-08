FROM node:18-alpine

# Install system dependencies including SSL libraries for Prisma
RUN apk add --no-cache curl openssl1.1-compat

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production
RUN npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads/avatars uploads/images

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["npm", "start"]