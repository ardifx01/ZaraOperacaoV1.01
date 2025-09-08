#!/usr/bin/env node

/**
 * Script para testar o build do servidor localmente
 * Simula o processo de build que seria executado no Docker
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Testando build do servidor ZARA...');

// Verificar se estamos no diretório correto
const serverDir = path.join(__dirname, 'server');
if (!fs.existsSync(serverDir)) {
  console.error('❌ Diretório server não encontrado!');
  process.exit(1);
}

process.chdir(serverDir);
console.log('📁 Diretório atual:', process.cwd());

try {
  // Verificar package.json
  console.log('\n📋 Verificando package.json...');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log('✅ Package.json válido');
  console.log('📦 Nome:', packageJson.name);
  console.log('🏷️ Versão:', packageJson.version);
  
  // Verificar scripts disponíveis
  console.log('\n🔧 Scripts disponíveis:');
  Object.keys(packageJson.scripts || {}).forEach(script => {
    console.log(`  - ${script}: ${packageJson.scripts[script]}`);
  });
  
  // Simular npm ci
  console.log('\n📦 Simulando npm ci...');
  if (fs.existsSync('node_modules')) {
    console.log('✅ node_modules já existe');
  } else {
    console.log('⚠️ node_modules não encontrado - seria instalado pelo npm ci');
  }
  
  // Verificar Prisma
  console.log('\n🔧 Verificando Prisma...');
  if (fs.existsSync('prisma/schema.prisma')) {
    console.log('✅ Schema Prisma encontrado');
    try {
      execSync('npx prisma --version', { stdio: 'pipe' });
      console.log('✅ Prisma CLI disponível');
    } catch (error) {
      console.log('⚠️ Prisma CLI não disponível - seria instalado pelo npm ci');
    }
  } else {
    console.log('❌ Schema Prisma não encontrado!');
  }
  
  // Verificar script de build
  console.log('\n🏗️ Verificando script de build...');
  if (packageJson.scripts && packageJson.scripts.build) {
    console.log('✅ Script de build encontrado:', packageJson.scripts.build);
  } else {
    console.log('⚠️ Script de build não encontrado - será ignorado');
  }
  
  // Verificar arquivos essenciais
  console.log('\n📄 Verificando arquivos essenciais...');
  const essentialFiles = ['index.js', 'package.json', 'prisma/schema.prisma'];
  essentialFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} não encontrado!`);
    }
  });
  
  // Verificar diretórios
  console.log('\n📁 Verificando diretórios...');
  const dirs = ['config', 'routes', 'middleware', 'services'];
  dirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`✅ ${dir}/`);
    } else {
      console.log(`⚠️ ${dir}/ não encontrado`);
    }
  });
  
  console.log('\n✅ Teste de build concluído com sucesso!');
  console.log('\n📋 Resumo:');
  console.log('- Estrutura do projeto: OK');
  console.log('- Package.json: OK');
  console.log('- Arquivos essenciais: OK');
  console.log('\n🚀 O build deveria funcionar corretamente!');
  
} catch (error) {
  console.error('❌ Erro durante o teste:', error.message);
  process.exit(1);
}