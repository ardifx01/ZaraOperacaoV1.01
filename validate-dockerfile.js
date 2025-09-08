#!/usr/bin/env node

/**
 * Script para validar a sintaxe e estrutura do Dockerfile
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validando Dockerfile do servidor...');

const dockerfilePath = path.join(__dirname, 'server', 'Dockerfile');

if (!fs.existsSync(dockerfilePath)) {
  console.error('❌ Dockerfile não encontrado em:', dockerfilePath);
  process.exit(1);
}

try {
  const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
  const lines = dockerfileContent.split('\n');
  
  console.log('📄 Analisando Dockerfile...');
  console.log('📏 Total de linhas:', lines.length);
  
  let hasErrors = false;
  const validInstructions = [
    'FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV', 'ADD', 'COPY',
    'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD',
    'STOPSIGNAL', 'HEALTHCHECK', 'SHELL'
  ];
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();
    
    // Pular linhas vazias e comentários
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }
    
    // Verificar se a linha começa com uma instrução válida
    const firstWord = trimmedLine.split(' ')[0].toUpperCase();
    
    if (!validInstructions.includes(firstWord)) {
      console.error(`❌ Linha ${lineNumber}: Instrução inválida '${firstWord}'`);
      console.error(`   Conteúdo: ${trimmedLine}`);
      hasErrors = true;
    } else {
      console.log(`✅ Linha ${lineNumber}: ${firstWord}`);
    }
  });
  
  // Verificações específicas
  console.log('\n🔧 Verificações específicas:');
  
  // Verificar se tem FROM
  const hasFrom = lines.some(line => line.trim().toUpperCase().startsWith('FROM'));
  if (hasFrom) {
    console.log('✅ Instrução FROM encontrada');
  } else {
    console.error('❌ Instrução FROM não encontrada');
    hasErrors = true;
  }
  
  // Verificar se tem CMD ou ENTRYPOINT
  const hasCmd = lines.some(line => 
    line.trim().toUpperCase().startsWith('CMD') || 
    line.trim().toUpperCase().startsWith('ENTRYPOINT')
  );
  if (hasCmd) {
    console.log('✅ Instrução CMD/ENTRYPOINT encontrada');
  } else {
    console.error('❌ Instrução CMD/ENTRYPOINT não encontrada');
    hasErrors = true;
  }
  
  // Verificar continuação de linha
  lines.forEach((line, index) => {
    if (line.endsWith('\\') && index < lines.length - 1) {
      const nextLine = lines[index + 1].trim();
      if (nextLine && !nextLine.startsWith(' ') && !nextLine.startsWith('\t')) {
        console.warn(`⚠️ Linha ${index + 2}: Possível problema de continuação`);
      }
    }
  });
  
  // Mostrar conteúdo completo para debug
  console.log('\n📋 Conteúdo completo do Dockerfile:');
  console.log('=' .repeat(50));
  lines.forEach((line, index) => {
    console.log(`${String(index + 1).padStart(2, '0')}: ${line}`);
  });
  console.log('=' .repeat(50));
  
  if (hasErrors) {
    console.error('\n❌ Dockerfile contém erros!');
    process.exit(1);
  } else {
    console.log('\n✅ Dockerfile válido!');
  }
  
} catch (error) {
  console.error('❌ Erro ao ler Dockerfile:', error.message);
  process.exit(1);
}