# Solução para Erro de Build no Railway - Sistema ZARA

## Problema Original

```
ERROR: failed to build: failed to solve: dockerfile parse error on line 25: unknown instruction: npm
```

**Linha problemática:**
```dockerfile
25 | >>> npm ci &&
```

## Causa do Problema

O erro ocorreu porque o Railway estava tentando usar uma sintaxe de cache mount mal formatada que quebrava a instrução `RUN`. A linha estava sendo interpretada como uma instrução independente `npm` em vez de fazer parte de um comando `RUN`.

## Solução Implementada

### 1. Novo Dockerfile na Raiz

Criado um novo `Dockerfile` na raiz do projeto com sintaxe correta:

```dockerfile
# Multi-stage build for ZARA system
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache curl git

# Set working directory
WORKDIR /app

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
```

### 2. Configuração do Railway Atualizada

Atualizado `server/railway.json` para usar o novo Dockerfile:

```json
{
  "build": {
    "builder": "dockerfile",
    "dockerfilePath": "../Dockerfile",
    "buildCommand": null,
    "watchPatterns": ["**/*"],
    "dockerContext": ".."
  }
}
```

### 3. Arquivo .dockerignore Otimizado

Criado `.dockerignore` na raiz para otimizar o build:

```
# Dependencies
node_modules/
*/node_modules/

# Environment files
.env
.env.local

# Logs
logs/
*.log
server/logs/

# Test files
*.test.js
test-*.js
check-*.js

# Development files
.github/
deploy.sh
deploy.ps1
```

### 4. Configuração Adicional railway.toml

Criado `railway.toml` para configurações extras:

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "cd server && npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "on-failure"

[env]
NODE_ENV = "production"
PORT = { default = "5000" }
```

## Arquivos Criados/Modificados

### ✅ Novos Arquivos
- `Dockerfile` (raiz do projeto)
- `.dockerignore` (raiz do projeto)
- `railway.toml` (configuração adicional)
- `railway-deploy.js` (script de verificação)

### ✅ Arquivos Modificados
- `server/railway.json` (atualizado dockerfilePath)

## Como Fazer Deploy

### Opção 1: Interface Web do Railway
1. Acesse [railway.app](https://railway.app)
2. Conecte seu repositório GitHub
3. O Railway detectará automaticamente o novo Dockerfile
4. Configure as variáveis de ambiente necessárias
5. Faça o deploy

### Opção 2: Railway CLI
```bash
# Instalar CLI (se necessário)
npm install -g @railway/cli

# Login
railway login

# Conectar ao projeto
railway link

# Fazer deploy
railway up
```

## Variáveis de Ambiente Necessárias

Configure estas variáveis no Railway:

### Essenciais
- `DATABASE_URL` - URL do banco PostgreSQL
- `JWT_SECRET` - Chave secreta para JWT
- `NODE_ENV=production`
- `PORT` (será definido automaticamente pelo Railway)

### Opcionais
- `CORS_ORIGIN` - URL do frontend
- `EMAIL_*` - Configurações de email
- `REDIS_URL` - URL do Redis (se usar)
- `SENTRY_DSN` - Para monitoramento de erros

## Verificação do Deploy

Após o deploy, verifique:

1. **Build bem-sucedido**: Logs do Railway devem mostrar build sem erros
2. **Aplicação iniciada**: Endpoint `/api/health` deve responder
3. **Banco conectado**: Verificar se Prisma consegue conectar
4. **Variáveis configuradas**: Todas as variáveis essenciais definidas

## Troubleshooting

### Se o build ainda falhar:
1. Verifique se está usando o Dockerfile correto
2. Limpe o cache do Railway (redeploy)
3. Verifique os logs de build para erros específicos
4. Use o `Dockerfile.simple` como alternativa

### Se a aplicação não iniciar:
1. Verifique as variáveis de ambiente
2. Confirme se o `DATABASE_URL` está correto
3. Verifique os logs da aplicação
4. Teste o health check endpoint

## Scripts de Teste

```bash
# Verificar configuração
node railway-deploy.js

# Validar Dockerfile
node validate-dockerfile.js

# Testar build local
node test-docker-build.js
```

## Suporte

Se o problema persistir:
1. Verifique os logs detalhados do Railway
2. Teste o build localmente com Docker
3. Consulte a documentação do Railway
4. Entre em contato com o suporte do Railway

---

**Status**: ✅ Problema resolvido com novo Dockerfile e configurações otimizadas.