const puppeteer = require('puppeteer');
const jwt = require('jsonwebtoken');

async function testBrowserConsole() {
  console.log('=== Teste de Console do Navegador - Página Teflon Change ===\n');
  
  let browser;
  try {
    // Gerar token do operador
    const operatorToken = jwt.sign(
      { id: 2, role: 'OPERATOR' },
      'your-secret-key',
      { expiresIn: '1h' }
    );
    
    console.log('🔑 Token do operador gerado');
    
    // Iniciar navegador
    browser = await puppeteer.launch({ 
      headless: false, // Mostrar navegador para debug
      defaultViewport: { width: 1280, height: 720 }
    });
    
    const page = await browser.newPage();
    
    // Capturar logs do console
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log('🖥️  Console:', text);
    });
    
    // Capturar erros
    page.on('pageerror', error => {
      console.log('❌ Erro na página:', error.message);
    });
    
    // Ir para a página de login
    console.log('\n📱 Navegando para página de login...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    
    // Definir token no localStorage
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({
        id: 2,
        name: 'Operador Teste',
        email: 'operador@teste.com',
        role: 'OPERATOR'
      }));
    }, operatorToken);
    
    console.log('✅ Token definido no localStorage');
    
    // Navegar para página de troca de teflon
    console.log('\n📱 Navegando para página de troca de teflon...');
    await page.goto('http://localhost:5173/teflon/change', { waitUntil: 'networkidle0' });
    
    // Aguardar um pouco para os logs aparecerem
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar se há select de máquinas na página
    const selectExists = await page.$('select');
    if (selectExists) {
      const options = await page.$$eval('select option', options => 
        options.map(option => ({ value: option.value, text: option.textContent }))
      );
      console.log('\n📋 Opções no select de máquinas:', options);
    } else {
      console.log('\n❌ Select de máquinas não encontrado na página');
    }
    
    // Resumo dos logs
    console.log('\n📊 Resumo dos logs do console:');
    const relevantLogs = consoleLogs.filter(log => 
      log.includes('TeflonChange') || 
      log.includes('useMachinePermissions') || 
      log.includes('máquinas') ||
      log.includes('permissões')
    );
    
    if (relevantLogs.length > 0) {
      console.log('✅ Logs relevantes encontrados:');
      relevantLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log}`);
      });
    } else {
      console.log('❌ Nenhum log relevante encontrado');
      console.log('   Todos os logs capturados:');
      consoleLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Executar teste
testBrowserConsole().catch(console.error);