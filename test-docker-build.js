#!/usr/bin/env node

/**
 * Script para testar o build do Docker localmente
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🐳 Testando build do Docker...');

const serverDir = path.join(__dirname, 'server');
const dockerfilePath = path.join(serverDir, 'Dockerfile');
const dockerfileSimplePath = path.join(serverDir, 'Dockerfile.simple');

// Verificar se os arquivos existem
if (!fs.existsSync(dockerfilePath)) {
  console.error('❌ Dockerfile não encontrado:', dockerfilePath);
  process.exit(1);
}

if (!fs.existsSync(dockerfileSimplePath)) {
  console.error('❌ Dockerfile.simple não encontrado:', dockerfileSimplePath);
  process.exit(1);
}

// Função para executar comando e capturar output
function runCommand(command, options = {}) {
  try {
    console.log(`🔧 Executando: ${command}`);
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      ...options 
    });
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      output: error.stdout || error.stderr || '' 
    };
  }
}

// Verificar se Docker está disponível
console.log('\n1️⃣ Verificando Docker...');
const dockerCheck = runCommand('docker --version');
if (!dockerCheck.success) {
  console.error('❌ Docker não está disponível:', dockerCheck.error);
  console.log('💡 Instale o Docker Desktop ou certifique-se de que está no PATH');
  process.exit(1);
}
console.log('✅ Docker disponível:', dockerCheck.output.trim());

// Testar build com Dockerfile original
console.log('\n2️⃣ Testando build com Dockerfile original...');
const buildOriginal = runCommand('docker build -t zara-server-test .', {
  cwd: serverDir
});

if (buildOriginal.success) {
  console.log('✅ Build original bem-sucedido!');
  
  // Testar execução
  console.log('\n3️⃣ Testando execução da imagem...');
  const runTest = runCommand('docker run --rm -d --name zara-test -p 5001:5000 zara-server-test');
  
  if (runTest.success) {
    console.log('✅ Container iniciado com sucesso!');
    
    // Aguardar um pouco e testar health check
    setTimeout(() => {
      console.log('\n4️⃣ Testando health check...');
      const healthCheck = runCommand('curl -f http://localhost:5001/api/health');
      
      if (healthCheck.success) {
        console.log('✅ Health check passou!');
      } else {
        console.log('⚠️ Health check falhou (normal se endpoint não existir):', healthCheck.error);
      }
      
      // Parar container
      console.log('\n🛑 Parando container de teste...');
      runCommand('docker stop zara-test');
      console.log('✅ Container parado!');
      
    }, 5000);
    
  } else {
    console.error('❌ Falha ao executar container:', runTest.error);
  }
  
} else {
  console.error('❌ Build original falhou:', buildOriginal.error);
  console.log('\n📋 Output do build:');
  console.log(buildOriginal.output);
  
  // Testar build com Dockerfile simplificado
  console.log('\n🔄 Testando build com Dockerfile simplificado...');
  const buildSimple = runCommand('docker build -f Dockerfile.simple -t zara-server-simple .', {
    cwd: serverDir
  });
  
  if (buildSimple.success) {
    console.log('✅ Build simplificado bem-sucedido!');
    console.log('💡 Use o Dockerfile.simple para deploy');
  } else {
    console.error('❌ Build simplificado também falhou:', buildSimple.error);
    console.log('\n📋 Output do build simplificado:');
    console.log(buildSimple.output);
  }
}

// Limpar imagens de teste
console.log('\n🧹 Limpando imagens de teste...');
runCommand('docker rmi zara-server-test zara-server-simple 2>/dev/null || true');

console.log('\n✅ Teste de build concluído!');
console.log('\n📝 Próximos passos:');
console.log('1. Se o build original funcionou, o problema pode ser específico da plataforma de deploy');
console.log('2. Se apenas o build simplificado funcionou, use o Dockerfile.simple');
console.log('3. Se ambos falharam, verifique as dependências e configurações');
console.log('4. Consulte o DOCKER-TROUBLESHOOTING.md para mais detalhes');