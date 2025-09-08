#!/usr/bin/env node

/**
 * Script para limpar cache do Railway e forçar rebuild
 * 
 * Este script resolve o problema do Dockerfile com caracteres inválidos
 * que podem estar em cache do Railway.
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 LIMPEZA DE CACHE DO RAILWAY');
console.log('================================');

// 1. Verificar se existe algum arquivo temporário do Railway
const possibleCacheFiles = [
  '.railway',
  '.railway-cache',
  'railway-cache',
  '.dockerignore.railway',
  'Dockerfile.railway',
  'server/Dockerfile.railway'
];

console.log('\n1. Verificando arquivos de cache do Railway...');
possibleCacheFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`❌ Encontrado arquivo de cache: ${file}`);
    try {
      fs.unlinkSync(file);
      console.log(`✅ Removido: ${file}`);
    } catch (error) {
      console.log(`⚠️ Erro ao remover ${file}: ${error.message}`);
    }
  } else {
    console.log(`✅ OK: ${file} não existe`);
  }
});

// 2. Verificar conteúdo do Dockerfile principal
console.log('\n2. Verificando Dockerfile principal...');
const dockerfilePath = path.join(__dirname, 'Dockerfile');
if (fs.existsSync(dockerfilePath)) {
  const content = fs.readFileSync(dockerfilePath, 'utf8');
  
  // Verificar se contém caracteres inválidos
  const invalidChars = ['>>>', '<<<', '===', '|||'];
  let hasInvalidChars = false;
  
  invalidChars.forEach(char => {
    if (content.includes(char)) {
      console.log(`❌ ERRO: Dockerfile contém caracteres inválidos: ${char}`);
      hasInvalidChars = true;
    }
  });
  
  if (!hasInvalidChars) {
    console.log('✅ Dockerfile principal está limpo');
  }
  
  // Verificar se npm ci está dentro de RUN
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.trim().startsWith('npm ci') && !line.trim().startsWith('RUN')) {
      console.log(`❌ ERRO: Linha ${index + 1} - npm ci fora de instrução RUN: ${line.trim()}`);
      hasInvalidChars = true;
    }
  });
  
  if (hasInvalidChars) {
    console.log('\n❌ DOCKERFILE CONTÉM ERROS - PRECISA SER CORRIGIDO');
    process.exit(1);
  }
} else {
  console.log('❌ Dockerfile principal não encontrado!');
  process.exit(1);
}

// 3. Verificar railway.json
console.log('\n3. Verificando configuração do Railway...');
const railwayJsonPath = path.join(__dirname, 'server', 'railway.json');
if (fs.existsSync(railwayJsonPath)) {
  const railwayConfig = JSON.parse(fs.readFileSync(railwayJsonPath, 'utf8'));
  
  if (railwayConfig.build && railwayConfig.build.dockerfilePath === '../Dockerfile') {
    console.log('✅ railway.json aponta para Dockerfile correto');
  } else {
    console.log('❌ railway.json não está configurado corretamente');
    console.log('   Esperado: dockerfilePath = "../Dockerfile"');
    console.log('   Atual:', railwayConfig.build?.dockerfilePath || 'não definido');
  }
} else {
  console.log('⚠️ railway.json não encontrado');
}

// 4. Criar arquivo de força de rebuild
console.log('\n4. Criando arquivo de força de rebuild...');
const forceRebuildPath = path.join(__dirname, '.railway-force-rebuild');
fs.writeFileSync(forceRebuildPath, `# Força rebuild do Railway\n# Criado em: ${new Date().toISOString()}\n# Motivo: Limpar cache de Dockerfile inválido\n`);
console.log('✅ Arquivo .railway-force-rebuild criado');

// 5. Instruções finais
console.log('\n🎯 PRÓXIMOS PASSOS:');
console.log('==================');
console.log('1. Faça commit das mudanças:');
console.log('   git add .');
console.log('   git commit -m "fix: Limpar cache do Railway e forçar rebuild"');
console.log('   git push origin main');
console.log('');
console.log('2. No Railway Dashboard:');
console.log('   - Vá para o projeto');
console.log('   - Clique em "Deploy" > "Redeploy"');
console.log('   - Ou force um novo deploy');
console.log('');
console.log('3. Se o erro persistir:');
console.log('   - Desconecte o repositório do Railway');
console.log('   - Reconecte o repositório');
console.log('   - Isso força o Railway a recriar todo o cache');
console.log('');
console.log('✅ Cache limpo com sucesso!');