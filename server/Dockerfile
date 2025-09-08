# Use Node.js LTS version
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci --only=production && npx prisma generate

# Copy application code
COPY . .

# Build application if needed
RUN npm run build || echo "No build script found, skipping..."

# Create uploads directory
RUN mkdir -p uploads/avatars uploads/images

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
CMD ["npm", "start"]