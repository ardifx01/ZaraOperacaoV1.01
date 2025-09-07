#!/usr/bin/env node

/**
 * Script para configuração automática de variáveis de ambiente
 * Sistema ZARA - Configuração de Deploy
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// Cores para console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`)
};

// Interface para input do usuário
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (prompt) => {
    return new Promise((resolve) => {
        rl.question(`${colors.cyan}?${colors.reset} ${prompt}: `, resolve);
    });
};

// Gerar secrets seguros
const generateSecret = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

// Templates de configuração
const templates = {
    // Configuração para desenvolvimento local
    development: {
        backend: {
            DATABASE_URL: 'file:./prisma/dev.db',
            JWT_SECRET: generateSecret(),
            JWT_EXPIRES_IN: '7d',
            PORT: '5000',
            NODE_ENV: 'development',
            CORS_ORIGIN: 'http://localhost:5173,http://localhost:3000',
            UPLOAD_MAX_SIZE: '10485760',
            UPLOAD_ALLOWED_TYPES: 'image/jpeg,image/png,image/gif,image/webp,application/pdf',
            UPLOAD_DIR: './uploads',
            LOG_LEVEL: 'debug',
            RATE_LIMIT_WINDOW_MS: '900000',
            RATE_LIMIT_MAX_REQUESTS: '1000',
            SESSION_SECRET: generateSecret(64),
            TRUST_PROXY: 'false',
            SECURE_COOKIES: 'false',
            APP_NAME: 'Sistema ZARA',
            APP_VERSION: '1.0.1',
            APP_URL: 'http://localhost:5173'
        },
        frontend: {
            VITE_API_URL: 'http://localhost:5000/api',
            VITE_SOCKET_URL: 'http://localhost:5000',
            VITE_APP_NAME: 'Sistema ZARA',
            VITE_APP_VERSION: '1.0.1',
            NODE_ENV: 'development'
        }
    },

    // Configuração para produção
    production: {
        backend: {
            DATABASE_URL: 'postgresql://usuario:senha@host:porta/database?schema=public',
            JWT_SECRET: generateSecret(),
            JWT_EXPIRES_IN: '7d',
            PORT: '5000',
            NODE_ENV: 'production',
            CORS_ORIGIN: 'https://seu-frontend.vercel.app',
            UPLOAD_MAX_SIZE: '10485760',
            UPLOAD_ALLOWED_TYPES: 'image/jpeg,image/png,image/gif,image/webp,application/pdf',
            UPLOAD_DIR: './uploads',
            LOG_LEVEL: 'info',
            LOG_FILE: 'logs/app.log',
            LOG_MAX_SIZE: '10m',
            LOG_MAX_FILES: '5',
            RATE_LIMIT_WINDOW_MS: '900000',
            RATE_LIMIT_MAX_REQUESTS: '100',
            SESSION_SECRET: generateSecret(64),
            TRUST_PROXY: 'true',
            SECURE_COOKIES: 'true',
            APP_NAME: 'Sistema ZARA',
            APP_VERSION: '1.0.1'
        },
        frontend: {
            VITE_API_URL: 'https://seu-backend.railway.app/api',
            VITE_SOCKET_URL: 'https://seu-backend.railway.app',
            VITE_APP_NAME: 'Sistema ZARA',
            VITE_APP_VERSION: '1.0.1',
            NODE_ENV: 'production',
            VITE_BUILD_MODE: 'production'
        }
    }
};

// Configurações específicas por plataforma
const platformConfigs = {
    vercel: {
        frontend: {
            VITE_API_URL: 'https://seu-backend.railway.app/api',
            VITE_SOCKET_URL: 'https://seu-backend.railway.app'
        }
    },
    railway: {
        backend: {
            PORT: '$PORT',
            DATABASE_URL: '$DATABASE_URL',
            CORS_ORIGIN: 'https://seu-frontend.vercel.app'
        }
    },
    render: {
        backend: {
            PORT: '10000',
            DATABASE_URL: '$DATABASE_URL',
            CORS_ORIGIN: 'https://seu-frontend.onrender.com'
        },
        frontend: {
            VITE_API_URL: 'https://seu-backend.onrender.com/api',
            VITE_SOCKET_URL: 'https://seu-backend.onrender.com'
        }
    },
    docker: {
        backend: {
            DATABASE_URL: 'postgresql://zara_user:zara_password@postgres:5432/zara_production',
            REDIS_URL: 'redis://redis:6379',
            CORS_ORIGIN: 'http://localhost:80'
        },
        frontend: {
            VITE_API_URL: 'http://localhost:5000/api',
            VITE_SOCKET_URL: 'http://localhost:5000'
        }
    }
};

// Função para criar arquivo .env
const createEnvFile = (filePath, config, comments = {}) => {
    let content = '# Configuração gerada automaticamente\n';
    content += `# Gerado em: ${new Date().toISOString()}\n\n`;

    for (const [key, value] of Object.entries(config)) {
        if (comments[key]) {
            content += `# ${comments[key]}\n`;
        }
        content += `${key}="${value}"\n`;
    }

    fs.writeFileSync(filePath, content);
    log.success(`Arquivo criado: ${filePath}`);
};

// Função principal de configuração
const setupEnvironment = async () => {
    log.title('🚀 CONFIGURAÇÃO DE AMBIENTE - SISTEMA ZARA');

    // Escolher tipo de ambiente
    console.log('Escolha o tipo de ambiente:');
    console.log('1. Desenvolvimento local');
    console.log('2. Produção');
    console.log('3. Docker');
    console.log('4. Configuração personalizada');

    const envType = await question('Digite sua escolha (1-4)');

    let config;
    let platform = null;

    switch (envType) {
        case '1':
            config = templates.development;
            log.info('Configurando para desenvolvimento local...');
            break;

        case '2':
            config = JSON.parse(JSON.stringify(templates.production));
            
            // Escolher plataforma
            console.log('\nEscolha a plataforma de deploy:');
            console.log('1. Vercel + Railway');
            console.log('2. Render');
            console.log('3. Configuração manual');
            
            const platformChoice = await question('Digite sua escolha (1-3)');
            
            switch (platformChoice) {
                case '1':
                    platform = 'vercel-railway';
                    Object.assign(config.backend, platformConfigs.railway.backend);
                    Object.assign(config.frontend, platformConfigs.vercel.frontend);
                    break;
                case '2':
                    platform = 'render';
                    Object.assign(config.backend, platformConfigs.render.backend);
                    Object.assign(config.frontend, platformConfigs.render.frontend);
                    break;
                case '3':
                    platform = 'manual';
                    break;
            }
            break;

        case '3':
            config = JSON.parse(JSON.stringify(templates.production));
            Object.assign(config.backend, platformConfigs.docker.backend);
            Object.assign(config.frontend, platformConfigs.docker.frontend);
            platform = 'docker';
            log.info('Configurando para Docker...');
            break;

        case '4':
            return await customSetup();

        default:
            log.error('Opção inválida!');
            process.exit(1);
    }

    // Configurações personalizadas
    if (platform !== 'docker') {
        const customizeConfig = await question('Deseja personalizar as configurações? (s/N)');
        
        if (customizeConfig.toLowerCase() === 's') {
            await customizeEnvironment(config);
        }
    }

    // Criar arquivos
    log.info('Criando arquivos de configuração...');

    // Backend .env
    const backendPath = path.join('server', '.env');
    createEnvFile(backendPath, config.backend);

    // Frontend .env.production
    const frontendPath = path.join('frontend', '.env.production');
    createEnvFile(frontendPath, config.frontend);

    // Criar arquivo de exemplo atualizado
    const examplePath = path.join('server', '.env.example');
    if (fs.existsSync(examplePath)) {
        const exampleConfig = { ...config.backend };
        // Mascarar valores sensíveis no exemplo
        Object.keys(exampleConfig).forEach(key => {
            if (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY')) {
                exampleConfig[key] = 'sua_chave_secreta_aqui';
            }
            if (key.includes('URL') && key !== 'APP_URL') {
                exampleConfig[key] = 'sua_url_aqui';
            }
        });
        createEnvFile(examplePath, exampleConfig);
    }

    log.success('\n✅ Configuração concluída!');
    
    if (platform) {
        log.info(`Plataforma configurada: ${platform}`);
    }
    
    log.warning('\n⚠️  IMPORTANTE:');
    log.warning('- Nunca commite arquivos .env para o repositório');
    log.warning('- Configure as variáveis de ambiente na sua plataforma de deploy');
    log.warning('- Atualize as URLs conforme seus domínios reais');
    
    if (envType === '2') {
        log.info('\n📝 Próximos passos:');
        log.info('1. Configure o banco de dados PostgreSQL');
        log.info('2. Atualize as URLs no arquivo .env');
        log.info('3. Configure as variáveis na plataforma de deploy');
        log.info('4. Execute as migrações do banco');
    }
};

// Configuração personalizada
const customizeEnvironment = async (config) => {
    log.title('🔧 CONFIGURAÇÃO PERSONALIZADA');

    // URLs principais
    const apiUrl = await question('URL da API (ex: https://api.exemplo.com)');
    if (apiUrl) {
        config.frontend.VITE_API_URL = `${apiUrl}/api`;
        config.frontend.VITE_SOCKET_URL = apiUrl;
    }

    const frontendUrl = await question('URL do Frontend (ex: https://app.exemplo.com)');
    if (frontendUrl) {
        config.backend.CORS_ORIGIN = frontendUrl;
        config.backend.APP_URL = frontendUrl;
    }

    // Banco de dados
    const dbUrl = await question('URL do banco PostgreSQL (deixe vazio para manter)');
    if (dbUrl) {
        config.backend.DATABASE_URL = dbUrl;
    }

    // Email (opcional)
    const configEmail = await question('Configurar email? (s/N)');
    if (configEmail.toLowerCase() === 's') {
        const emailHost = await question('Host SMTP (ex: smtp.gmail.com)');
        const emailUser = await question('Email do usuário');
        const emailPass = await question('Senha do email (senha de app)');
        
        if (emailHost) config.backend.EMAIL_HOST = emailHost;
        if (emailUser) {
            config.backend.EMAIL_USER = emailUser;
            config.backend.EMAIL_FROM = `Sistema ZARA <${emailUser}>`;
        }
        if (emailPass) config.backend.EMAIL_PASS = emailPass;
    }

    log.success('Configuração personalizada aplicada!');
};

// Setup personalizado completo
const customSetup = async () => {
    log.title('🛠️  CONFIGURAÇÃO PERSONALIZADA COMPLETA');
    
    const config = {
        backend: {},
        frontend: {}
    };

    // Configurações básicas
    config.backend.NODE_ENV = 'production';
    config.backend.JWT_SECRET = generateSecret();
    config.backend.SESSION_SECRET = generateSecret(64);
    
    log.info('Configure as informações básicas:');
    
    // Continuar com configuração manual...
    await customizeEnvironment(config);
    
    return config;
};

// Executar script
if (require.main === module) {
    setupEnvironment()
        .then(() => {
            rl.close();
            process.exit(0);
        })
        .catch((error) => {
            log.error(`Erro: ${error.message}`);
            rl.close();
            process.exit(1);
        });
}

module.exports = {
    setupEnvironment,
    templates,
    platformConfigs,
    generateSecret
};