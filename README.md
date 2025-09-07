# Sistema ZARA Operação v1.01

## 📋 Descrição

Sistema operacional ZARA para controle de qualidade e operações industriais com 3 ambientes distintos:

- **Operador**: Testes de qualidade, controle de máquinas e upload de mídia
- **Líder**: Monitoramento de status, relatórios e históricos
- **Gestor**: Dashboard avançado com gráficos e relatórios completos

## 🚀 Stack Tecnológica

### Backend
- **Node.js** + **Express**
- **MongoDB** + **Prisma ORM**
- **Socket.IO** + **Redis** (tempo real)
- **JWT** (autenticação)
- **Nodemailer** + **FCM** (notificações)
- **PM2** + **Sentry** (monitoramento)

### Frontend
- **React** + **Vite**
- **Tailwind CSS**
- **Chart.js** (gráficos)
- **Socket.IO Client** (tempo real)

### Testes
- **Jest** + **Supertest**

## 📦 Instalação

### Pré-requisitos
- Node.js >= 18.0.0
- MongoDB
- Redis
- NPM >= 9.0.0

### Instalação Rápida

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd ZaraOperacaoV1.01

# Instale todas as dependências
npm run install:all

# Configure as variáveis de ambiente
cp server/.env.example server/.env
# Edite o arquivo server/.env com suas configurações

# Execute as migrações do banco
cd server
npm run prisma:push
npm run prisma:generate

# Inicie o sistema em modo desenvolvimento
cd ..
npm run dev
```

## 🔧 Configuração

### Variáveis de Ambiente

Configure o arquivo `server/.env` com suas credenciais:

- **MongoDB**: String de conexão
- **Redis**: URL do Redis
- **JWT**: Chave secreta
- **Email**: Configurações SMTP
- **Firebase**: Credenciais FCM
- **Sentry**: DSN para monitoramento

## 🏃‍♂️ Execução

### Desenvolvimento
```bash
npm run dev  # Inicia servidor e cliente simultaneamente
```

### Produção
```bash
npm run build  # Build do frontend
npm start      # Inicia com PM2
```

## 📱 Funcionalidades

### 👷 Ambiente Operador
- Login seguro
- Seleção de máquina (20 min para iniciar operação)
- Formulário de teste de qualidade:
  - Produto, lote, número da caixa
  - Dimensões da embalagem
  - Testes de régua e hermeticidade
  - Upload de imagens e vídeos
  - Aprovação/Reprovação
- Controle de troca de teflon com alertas

### 👨‍💼 Ambiente Líder
- Dashboard de status das máquinas
- Relatórios de testes de qualidade
- Histórico de trocas de teflon
- Alertas de prazos vencendo

### 👔 Ambiente Gestor
- Todos os relatórios e dados avançados
- Gráficos interativos (Chart.js)
- Export de relatórios
- Visão completa do sistema

## 🔔 Sistema de Notificações

- **Email**: Alertas automáticos via Nodemailer
- **Push**: Notificações em tempo real via FCM
- **Socket.IO**: Atualizações instantâneas na interface

## 🧪 Testes

```bash
cd server
npm test        # Testes em modo watch
npm run test:ci # Testes com coverage
```

## 📊 Monitoramento

- **PM2**: Gerenciamento de processos
- **Sentry**: Monitoramento de erros
- **Logs**: Arquivos de log estruturados

## 🎨 Design System

**Cor Principal**: `#000688` (Azul ZARA)

## 📄 Licença

MIT License - Sistema ZARA Operação v1.01