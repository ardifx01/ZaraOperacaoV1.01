# Deploy no Vercel - Sistema ZARA

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

### 5. Configuração do Frontend

Atualize o arquivo `.env.production` do frontend:

```bash
VITE_API_URL="https://seu-backend.vercel.app"
VITE_NODE_ENV="production"
```

### 6. Comandos Úteis

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