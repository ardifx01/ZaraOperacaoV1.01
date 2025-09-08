#!/usr/bin/env node

/**
 * Script para deploy no Railway com verificações específicas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚂 Preparando deploy para Railway...');

// Verificar estrutura do projeto
const requiredFiles = [
  'Dockerfile',
  'server/package.json',
  'server/prisma/schema.prisma',
  'server/railway.json'
];

console.log('\n1️⃣ Verificando arquivos necessários...');
let missingFiles = [];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file}`);
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.error('\n❌ Arquivos obrigatórios não encontrados:', missingFiles);
  process.exit(1);
}

// Verificar configuração do Railway
console.log('\n2️⃣ Verificando configuração do Railway...');
try {
  const railwayConfig = JSON.parse(fs.readFileSync('server/railway.json', 'utf8'));
  
  if (railwayConfig.build && railwayConfig.build.dockerfilePath) {
    console.log(`✅ Dockerfile configurado: ${railwayConfig.build.dockerfilePath}`);
  }
  
  if (railwayConfig.environments && railwayConfig.environments.production) {
    const envVars = Object.keys(railwayConfig.environments.production.variables);
    console.log(`✅ Variáveis de ambiente configuradas: ${envVars.length}`);
  }
  
} catch (error) {
  console.error('❌ Erro ao ler railway.json:', error.message);
  process.exit(1);
}

// Verificar Dockerfile
console.log('\n3️⃣ Validando Dockerfile...');
try {
  const dockerfileContent = fs.readFileSync('Dockerfile', 'utf8');
  const lines = dockerfileContent.split('\n');
  
  const hasFrom = lines.some(line => line.trim().toUpperCase().startsWith('FROM'));
  const hasCmd = lines.some(line => 
    line.trim().toUpperCase().startsWith('CMD') || 
    line.trim().toUpperCase().startsWith('ENTRYPOINT')
  );
  
  if (hasFrom && hasCmd) {
    console.log('✅ Dockerfile válido');
  } else {
    console.error('❌ Dockerfile inválido - faltam instruções FROM ou CMD');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Erro ao validar Dockerfile:', error.message);
  process.exit(1);
}

// Verificar dependências do servidor
console.log('\n4️⃣ Verificando dependências do servidor...');
try {
  const packageJson = JSON.parse(fs.readFileSync('server/package.json', 'utf8'));
  
  const requiredDeps = ['express', 'prisma', '@prisma/client'];
  const missingDeps = requiredDeps.filter(dep => 
    !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
  );
  
  if (missingDeps.length === 0) {
    console.log('✅ Dependências essenciais presentes');
  } else {
    console.warn('⚠️ Dependências possivelmente ausentes:', missingDeps);
  }
  
  if (packageJson.scripts && packageJson.scripts.start) {
    console.log('✅ Script de start configurado');
  } else {
    console.error('❌ Script de start não encontrado');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Erro ao verificar package.json:', error.message);
  process.exit(1);
}

// Criar arquivo de configuração adicional para Railway
console.log('\n5️⃣ Criando configurações adicionais...');

const railwayToml = `[build]
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
`;

fs.writeFileSync('railway.toml', railwayToml);
console.log('✅ railway.toml criado');

// Verificar se Railway CLI está disponível
console.log('\n6️⃣ Verificando Railway CLI...');
try {
  const railwayVersion = execSync('railway --version', { encoding: 'utf8' });
  console.log('✅ Railway CLI disponível:', railwayVersion.trim());
  
  // Tentar fazer login (se não estiver logado)
  try {
    execSync('railway whoami', { encoding: 'utf8', stdio: 'pipe' });
    console.log('✅ Usuário logado no Railway');
  } catch {
    console.log('⚠️ Não logado no Railway. Execute: railway login');
  }
  
} catch (error) {
  console.log('⚠️ Railway CLI não encontrado. Instale com: npm install -g @railway/cli');
}

console.log('\n✅ Verificações concluídas!');
console.log('\n📝 Próximos passos para deploy:');
console.log('1. railway login (se necessário)');
console.log('2. railway link (para conectar ao projeto)');
console.log('3. railway up (para fazer deploy)');
console.log('\n💡 Ou use a interface web do Railway para fazer deploy via GitHub');

console.log('\n🔧 Arquivos de configuração criados:');
console.log('- Dockerfile (na raiz)');
console.log('- .dockerignore (na raiz)');
console.log('- railway.toml (configuração adicional)');
console.log('- server/railway.json (configuração principal)');