# Docker Build Troubleshooting - Sistema ZARA

## Problema Reportado

```
ERROR: failed to build: failed to solve: dockerfile parse error on line 25: unknown instruction: npm
```

## Análise

O erro mencionado não corresponde ao conteúdo atual do Dockerfile. Possíveis causas:

### 1. Cache de Build Antigo
- **Problema**: Docker está usando uma versão em cache do Dockerfile
- **Solução**: Limpar cache do Docker
```bash
docker system prune -f
docker builder prune -f
```

### 2. Arquivo Dockerfile Incorreto
- **Problema**: Build está usando um Dockerfile diferente
- **Verificação**: Confirmar que está usando o Dockerfile correto
```bash
# Verificar conteúdo do Dockerfile
cat server/Dockerfile

# Verificar se há outros Dockerfiles
find . -name "Dockerfile*" -type f
```

### 3. Plataforma de Build
- **Problema**: Diferentes plataformas podem ter comportamentos distintos
- **Soluções por plataforma**:

#### Railway
```bash
# Usar o railway.json para configurações específicas
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "server/Dockerfile"
  }
}
```

#### Render
```yaml
# render.yaml
services:
  - type: web
    name: zara-backend
    env: docker
    dockerfilePath: ./server/Dockerfile
```

#### Vercel (não suporta Dockerfile diretamente)
```json
{
  "builds": [
    {
      "src": "server/index.js",
      "use": "@vercel/node"
    }
  ]
}
```

### 4. Problemas de Sintaxe
- **Verificação**: Usar o script de validação
```bash
node validate-dockerfile.js
```

## Dockerfile Atual (Validado)

O Dockerfile atual está correto e validado:

```dockerfile
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache curl

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
```

## Alternativas de Deploy

### 1. Build Local + Push de Imagem
```bash
# Build local
docker build -t zara-server ./server

# Tag para registry
docker tag zara-server your-registry/zara-server:latest

# Push para registry
docker push your-registry/zara-server:latest
```

### 2. Dockerfile Simplificado
Se o problema persistir, usar versão mais simples:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/prisma ./prisma/
RUN npx prisma generate
COPY server/ .
RUN mkdir -p uploads/avatars uploads/images
EXPOSE 5000
CMD ["npm", "start"]
```

### 3. Multi-stage Build
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npx prisma generate

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY . .
RUN mkdir -p uploads/avatars uploads/images
EXPOSE 5000
CMD ["npm", "start"]
```

## Scripts de Teste

### Validar Estrutura
```bash
node build-test.js
```

### Validar Dockerfile
```bash
node validate-dockerfile.js
```

### Testar Build Local
```bash
cd server
docker build -t zara-test .
docker run -p 5000:5000 zara-test
```

## Próximos Passos

1. **Verificar plataforma específica**: Confirmar qual plataforma está sendo usada
2. **Limpar cache**: Executar comandos de limpeza de cache
3. **Testar localmente**: Fazer build local para confirmar funcionamento
4. **Usar alternativas**: Se problema persistir, usar Dockerfile simplificado
5. **Contatar suporte**: Se nada funcionar, contatar suporte da plataforma

## Logs Úteis

- Build logs da plataforma
- Output do `docker build`
- Resultado dos scripts de validação
- Configurações de ambiente da plataforma