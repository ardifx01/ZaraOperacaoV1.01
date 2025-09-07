# 🚀 Guia Completo de Deploy - Sistema ZARA

Este guia fornece instruções detalhadas para colocar o Sistema ZARA online usando diferentes estratégias e plataformas.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Git configurado
- Docker e Docker Compose (para deploy local/VPS)
- Contas nas plataformas de deploy escolhidas

## 🎯 Estratégias de Deploy

### 🚀 Deploy Rápido (Recomendado)

Use os scripts automatizados incluídos no projeto:

**Windows:**
```powershell
.\deploy.ps1
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

Esses scripts fazem:
- ✅ Verificação de dependências
- ✅ Configuração de ambiente
- ✅ Build das imagens Docker
- ✅ Execução de migrações
- ✅ Inicialização da aplicação

## 🎯 Opções de Deploy

### 1. Deploy com Docker (Recomendado)

#### Pré-requisitos
- Docker e Docker Compose instalados

#### Passos

1. **Clone o repositório:**
```bash
git clone <seu-repositorio>
cd ZaraOperacaoV1.01
```

2. **Configure as variáveis de ambiente:**
```bash
# Copie e edite o arquivo de ambiente
cp server/.env.example server/.env
```

3. **Configure o arquivo .env do servidor:**
```env
NODE_ENV=production
PORT=5000
JWT_SECRET=seu_jwt_secret_muito_seguro_aqui
CORS_ORIGIN=https://seu-dominio.com
DATABASE_URL=file:./dev.db
```

4. **Configure o arquivo .env.production do frontend:**
```env
VITE_API_URL=https://seu-backend.com/api
VITE_SOCKET_URL=https://seu-backend.com
```

5. **Execute com Docker Compose:**
```bash
docker-compose up -d
```

### 2. Deploy no Vercel (Frontend) + Railway (Backend)

#### Frontend no Vercel

1. **Instale a CLI do Vercel:**
```bash
npm i -g vercel
```

2. **Configure o frontend:**
```bash
cd frontend
vercel
```

3. **Configure as variáveis de ambiente no Vercel:**
- `VITE_API_URL`: URL do seu backend
- `VITE_SOCKET_URL`: URL do seu backend
- `VITE_APP_NAME`: Sistema ZARA
- `VITE_APP_VERSION`: 1.0.1

#### Backend no Railway

1. **Acesse [Railway.app](https://railway.app)**

2. **Conecte seu repositório GitHub**

3. **Configure as variáveis de ambiente:**
```env
NODE_ENV=production
PORT=5000
JWT_SECRET=seu_jwt_secret_muito_seguro
CORS_ORIGIN=https://seu-frontend-vercel.vercel.app
DATABASE_URL=postgresql://usuario:senha@host:porta/database
```

4. **Configure o comando de start:**
```json
{
  "scripts": {
    "start": "node index.js"
  }
}
```

### 3. Deploy no Render (Fullstack)

#### Backend

1. **Acesse [Render.com](https://render.com)**

2. **Crie um novo Web Service**

3. **Configure:**
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `npm start`
   - Environment: Node

4. **Variáveis de ambiente:**
```env
NODE_ENV=production
JWT_SECRET=seu_jwt_secret
CORS_ORIGIN=https://seu-frontend.onrender.com
DATABASE_URL=postgresql://...
```

#### Frontend

1. **Crie um novo Static Site**

2. **Configure:**
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

3. **Variáveis de ambiente:**
```env
VITE_API_URL=https://seu-backend.onrender.com/api
VITE_SOCKET_URL=https://seu-backend.onrender.com
```

### 4. Deploy Manual (VPS/Servidor Próprio)

#### Pré-requisitos
- Servidor Ubuntu/CentOS
- Nginx instalado
- PM2 instalado globalmente
- Certificado SSL (Let's Encrypt)

#### Backend

1. **Clone e configure:**
```bash
git clone <repositorio>
cd ZaraOperacaoV1.01/server
npm install
npx prisma generate
```

2. **Configure PM2:**
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### Frontend

1. **Build e deploy:**
```bash
cd ../frontend
npm install
npm run build
sudo cp -r dist/* /var/www/html/
```

2. **Configure Nginx:**
```nginx
server {
    listen 80;
    server_name seu-dominio.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔧 Configurações Importantes

### Banco de Dados

**Para produção, recomenda-se PostgreSQL:**

1. **Configure a DATABASE_URL:**
```env
DATABASE_URL="postgresql://usuario:senha@host:porta/database?schema=public"
```

2. **Execute as migrações:**
```bash
npx prisma db push
```

### Segurança

1. **JWT_SECRET:** Use uma chave forte e única
2. **CORS_ORIGIN:** Configure apenas os domínios permitidos
3. **HTTPS:** Sempre use SSL em produção
4. **Variáveis de ambiente:** Nunca commite secrets no código

### Performance

1. **Gzip:** Habilitado no Nginx
2. **Cache:** Configurado para assets estáticos
3. **Minificação:** Automática no build do Vite
4. **Lazy Loading:** Implementado nas rotas React

## 🔍 Verificação do Deploy

### Checklist pós-deploy:

- [ ] Frontend carrega corretamente
- [ ] API responde em `/api/health`
- [ ] WebSocket conecta (Socket.IO)
- [ ] Login funciona
- [ ] Dashboard carrega dados
- [ ] Notificações em tempo real funcionam
- [ ] Upload de arquivos funciona
- [ ] Responsividade mobile OK

### URLs de teste:

- Frontend: `https://seu-dominio.com`
- API Health: `https://seu-backend.com/api/health`
- API Docs: `https://seu-backend.com/api/docs` (se implementado)

## 🆘 Troubleshooting

### Problemas Comuns:

1. **CORS Error:**
   - Verifique CORS_ORIGIN no backend
   - Confirme URLs no frontend (.env.production)

2. **Database Connection:**
   - Verifique DATABASE_URL
   - Execute `npx prisma db push`

3. **WebSocket não conecta:**
   - Verifique proxy do Nginx
   - Confirme VITE_SOCKET_URL

4. **Build falha:**
   - Verifique versão do Node.js
   - Limpe cache: `npm ci`

## 📞 Suporte

Para problemas específicos:
1. Verifique os logs do servidor
2. Teste localmente primeiro
3. Verifique as variáveis de ambiente
4. Consulte a documentação da plataforma de deploy

---

**Última atualização:** Janeiro 2025
**Versão:** 1.0.1