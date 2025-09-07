#!/usr/bin/env node

/**
 * Script de validação de serviços em execução
 * Testa se os serviços estão rodando e respondendo corretamente
 */

const http = require('http');
const https = require('https');

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}🔍 ${msg}${colors.reset}\n`)
};

class ServiceValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      services: []
    };
  }

  // Fazer requisição HTTP/HTTPS
  makeRequest(url, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const req = client.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: timeout,
        headers: {
          'User-Agent': 'ServiceValidator/1.0'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }

  // Testar serviço individual
  async testService(name, url, expectedStatus = 200) {
    try {
      log.info(`Testando ${name}: ${url}`);
      
      const response = await this.makeRequest(url);
      
      if (response.statusCode === expectedStatus) {
        log.success(`${name} está funcionando (${response.statusCode})`);
        this.results.passed++;
        this.results.services.push({ name, url, status: 'pass', statusCode: response.statusCode });
      } else {
        log.warning(`${name} retornou status ${response.statusCode} (esperado: ${expectedStatus})`);
        this.results.failed++;
        this.results.services.push({ name, url, status: 'fail', statusCode: response.statusCode });
      }
    } catch (error) {
      log.error(`${name} falhou: ${error.message}`);
      this.results.failed++;
      this.results.services.push({ name, url, status: 'fail', error: error.message });
    }
  }

  // Executar todos os testes de serviços
  async validateServices() {
    log.header('VALIDAÇÃO DE SERVIÇOS EM EXECUÇÃO');
    
    // Serviços para testar
    const services = [
      { name: 'Backend API', url: 'http://localhost:5000/api/health' },
      { name: 'Frontend Dev', url: 'http://localhost:5173' },
      { name: 'Prisma Studio 1', url: 'http://localhost:5555' },
      { name: 'Prisma Studio 2', url: 'http://localhost:5556' }
    ];

    // Testar cada serviço
    for (const service of services) {
      await this.testService(service.name, service.url);
      // Pequena pausa entre testes
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.showResults();
  }

  // Mostrar resultados
  showResults() {
    log.header('RESULTADOS DA VALIDAÇÃO');
    
    console.log(`${colors.green}✅ Serviços funcionando: ${this.results.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Serviços com problema: ${this.results.failed}${colors.reset}`);
    
    const total = this.results.passed + this.results.failed;
    const score = total > 0 ? Math.round((this.results.passed / total) * 100) : 0;
    
    console.log(`\n${colors.cyan}📊 Score de Disponibilidade: ${score}%${colors.reset}`);
    
    if (score >= 80) {
      log.success('Serviços estão funcionando bem! 🚀');
    } else if (score >= 50) {
      log.warning('Alguns serviços precisam de atenção.');
    } else {
      log.error('Muitos serviços com problemas.');
    }

    // Mostrar detalhes dos serviços com problema
    const failedServices = this.results.services.filter(s => s.status === 'fail');
    if (failedServices.length > 0) {
      console.log(`\n${colors.yellow}⚠️  SERVIÇOS COM PROBLEMA:${colors.reset}`);
      failedServices.forEach(service => {
        console.log(`   • ${service.name}: ${service.error || `Status ${service.statusCode}`}`);
      });
      
      console.log(`\n${colors.blue}💡 DICAS:${colors.reset}`);
      console.log('   • Verifique se os serviços estão rodando');
      console.log('   • Confirme as portas configuradas');
      console.log('   • Verifique logs de erro nos terminais');
    }

    // Mostrar serviços funcionando
    const workingServices = this.results.services.filter(s => s.status === 'pass');
    if (workingServices.length > 0) {
      console.log(`\n${colors.green}✅ SERVIÇOS FUNCIONANDO:${colors.reset}`);
      workingServices.forEach(service => {
        console.log(`   • ${service.name}: ${service.url}`);
      });
    }
  }

  // Testar conectividade básica de rede
  async testNetworkConnectivity() {
    log.header('TESTE DE CONECTIVIDADE DE REDE');
    
    const testUrls = [
      'http://www.google.com',
      'https://api.github.com',
      'https://registry.npmjs.org'
    ];

    for (const url of testUrls) {
      try {
        await this.makeRequest(url, 3000);
        log.success(`Conectividade OK: ${url}`);
      } catch (error) {
        log.error(`Falha de conectividade: ${url} - ${error.message}`);
      }
    }
  }
}

// Executar validação se chamado diretamente
if (require.main === module) {
  const validator = new ServiceValidator();
  
  async function runValidation() {
    try {
      await validator.testNetworkConnectivity();
      await validator.validateServices();
    } catch (error) {
      log.error(`Erro durante a validação: ${error.message}`);
      process.exit(1);
    }
  }
  
  runValidation();
}

module.exports = ServiceValidator;