# Deploy no Vercel - Sistema ZARA

## Visão Geral

Este guia explica como fazer o deploy completo do Sistema ZARA no Vercel:
- **Backend**: API Node.js/Express (diretório `server`)
- **Frontend**: Aplicação React/Vite (diretório `frontend`)

## Configuração do Backend

### 1. Preparação

1. Faça login no Vercel: https://vercel.com
2. Conecte sua conta GitHub
3. Importe o repositório do projeto

### 2. Configuração das Variáveis de Ambiente

No painel do Vercel, configure as seguintes variáveis:

```bash
# Banco de Dados (PostgreSQL)
DATABASE_URL="postgresql://usuario:senha@host:porta/database?schema=public"

# JWT
JWT_SECRET="seu_jwt_secret_muito_seguro_aqui"
JWT_EXPIRES_IN="7d"

# Servidor
NODE_ENV="production"
PORT="5000"

# CORS - URLs do frontend
CORS_ORIGIN="https://seu-frontend.vercel.app"

# Upload
UPLOAD_MAX_SIZE="10485760"
UPLOAD_ALLOWED_TYPES="image/jpeg,image/png,image/gif,image/webp,application/pdf"
```

### 3. Configuração do Banco de Dados

Recomendações para produção:

#### Opção 1: Supabase (Recomendado)
1. Acesse https://supabase.com
2. Crie um novo projeto
3. Copie a URL de conexão PostgreSQL
4. Configure a variável `DATABASE_URL`

#### Opção 2: Railway
1. Acesse https://railway.app
2. Crie um banco PostgreSQL
3. Copie a URL de conexão
4. Configure a variável `DATABASE_URL`

#### Opção 3: Render
1. Acesse https://render.com
2. Crie um banco PostgreSQL
3. Copie a URL de conexão
4. Configure a variável `DATABASE_URL`

### 4. Deploy

1. No Vercel, selecione o diretório `server` como root directory
2. Configure o build command: `npm install && npx prisma generate`
3. Configure o output directory: `./`
4. Faça o deploy

## Configuração do Frontend

### 1. Deploy do Frontend

1. No Vercel, crie um novo projeto para o frontend
2. Selecione o diretório `frontend` como root directory
3. Configure o framework preset como "Vite"
4. Configure as variáveis de ambiente

### 2. Variáveis de Ambiente do Frontend

Configure no painel do Vercel:

```bash
# URL da API (substitua pela URL real do seu backend)
VITE_API_URL="https://seu-backend.vercel.app/api"
VITE_SOCKET_URL="https://seu-backend.vercel.app"

# Configurações da aplicação
VITE_APP_NAME="Sistema ZARA"
VITE_APP_VERSION="1.0.1"
VITE_NODE_ENV="production"

# Configurações de build
VITE_BUILD_SOURCEMAP="false"
VITE_BUILD_MINIFY="true"
```

### 3. Atualização Automática

O arquivo `.env.production` será usado automaticamente:

```bash
VITE_API_URL=https://seu-backend.vercel.app/api
VITE_SOCKET_URL=https://seu-backend.vercel.app
VITE_NODE_ENV=production
```

## Ordem de Deploy Recomendada

### 1. Deploy do Backend Primeiro
1. Configure o banco de dados (Supabase/Railway/Render)
2. Faça deploy do backend no Vercel
3. Anote a URL do backend (ex: `https://zara-backend.vercel.app`)
4. Teste a API: `https://zara-backend.vercel.app/api/health`

### 2. Deploy do Frontend
1. Configure as variáveis de ambiente com a URL real do backend
2. Faça deploy do frontend no Vercel
3. Teste a aplicação completa

### 3. Configuração Final
1. Atualize CORS_ORIGIN no backend com a URL do frontend
2. Teste todas as funcionalidades
3. Configure domínio personalizado (opcional)

## Comandos Úteis

```bash
# Gerar cliente Prisma
npx prisma generate

# Aplicar migrações
npx prisma db push

# Visualizar banco
npx prisma studio
```

### 7. Troubleshooting

#### Erro de Prisma
- Certifique-se de que `npx prisma generate` está no build command
- Verifique se a `DATABASE_URL` está correta

#### Erro de CORS
- Verifique se `CORS_ORIGIN` inclui a URL do frontend
- Teste com `*` temporariamente para debug

#### Timeout
- Aumente `maxDuration` no vercel.json se necessário
- Otimize queries do banco de dados

### 8. Monitoramento

- Use o painel do Vercel para logs
- Configure alertas para erros
- Monitore performance das funções

## URLs de Exemplo

- Backend: `https://zara-backend.vercel.app`
- Frontend: `https://zara-frontend.vercel.app`
- API Health: `https://zara-backend.vercel.app/api/health`