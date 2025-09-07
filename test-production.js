#!/usr/bin/env node

/**
 * Script de teste para verificar configurações de produção
 * Executa uma série de testes para validar se o sistema está pronto para deploy
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}🔍 ${msg}${colors.reset}\n`)
};

class ProductionTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  // Executar teste individual
  async runTest(name, testFn) {
    try {
      log.info(`Testando: ${name}`);
      const result = await testFn();
      
      if (result.status === 'pass') {
        log.success(result.message);
        this.results.passed++;
      } else if (result.status === 'warning') {
        log.warning(result.message);
        this.results.warnings++;
      } else {
        log.error(result.message);
        this.results.failed++;
      }
      
      this.results.tests.push({ name, ...result });
    } catch (error) {
      log.error(`${name}: ${error.message}`);
      this.results.failed++;
      this.results.tests.push({ name, status: 'fail', message: error.message });
    }
  }

  // Teste 1: Verificar arquivos essenciais
  async testEssentialFiles() {
    const requiredFiles = [
      'package.json',
      'docker-compose.yml',
      'DEPLOY.md',
      'server/package.json',
      'server/index.js',
      'server/.env.example',
      'server/prisma/schema.prisma',
      'frontend/package.json',
      'frontend/Dockerfile',
      'frontend/nginx.conf',
      '.github/workflows/deploy.yml'
    ];

    const missing = [];
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        missing.push(file);
      }
    }

    if (missing.length === 0) {
      return { status: 'pass', message: 'Todos os arquivos essenciais estão presentes' };
    } else {
      return { status: 'fail', message: `Arquivos faltando: ${missing.join(', ')}` };
    }
  }

  // Teste 2: Verificar configurações de ambiente
  async testEnvironmentConfig() {
    const envExample = path.join('server', '.env.example');
    
    if (!fs.existsSync(envExample)) {
      return { status: 'fail', message: 'Arquivo .env.example não encontrado' };
    }

    const envContent = fs.readFileSync(envExample, 'utf8');
    const requiredVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'CORS_ORIGIN',
      'NODE_ENV',
      'PORT'
    ];

    const missing = requiredVars.filter(varName => !envContent.includes(varName));
    
    if (missing.length === 0) {
      return { status: 'pass', message: 'Variáveis de ambiente essenciais configuradas' };
    } else {
      return { status: 'fail', message: `Variáveis faltando no .env.example: ${missing.join(', ')}` };
    }
  }

  // Teste 3: Verificar dependências do servidor
  async testServerDependencies() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('server/package.json', 'utf8'));
      const requiredDeps = [
        'express',
        'cors',
        'helmet',
        'express-rate-limit',
        '@prisma/client',
        'jsonwebtoken',
        'bcryptjs'
      ];

      const missing = requiredDeps.filter(dep => 
        !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
      );

      if (missing.length === 0) {
        return { status: 'pass', message: 'Dependências do servidor OK' };
      } else {
        return { status: 'fail', message: `Dependências faltando: ${missing.join(', ')}` };
      }
    } catch (error) {
      return { status: 'fail', message: 'Erro ao verificar package.json do servidor' };
    }
  }

  // Teste 4: Verificar dependências do frontend
  async testFrontendDependencies() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
      const requiredDeps = [
        'react',
        'react-dom',
        'vite',
        'axios'
      ];

      const missing = requiredDeps.filter(dep => 
        !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
      );

      if (missing.length === 0) {
        return { status: 'pass', message: 'Dependências do frontend OK' };
      } else {
        return { status: 'fail', message: `Dependências faltando: ${missing.join(', ')}` };
      }
    } catch (error) {
      return { status: 'fail', message: 'Erro ao verificar package.json do frontend' };
    }
  }

  // Teste 5: Verificar configuração do Docker
  async testDockerConfig() {
    const dockerFiles = [
      'docker-compose.yml',
      'server/Dockerfile',
      'frontend/Dockerfile'
    ];

    const missing = dockerFiles.filter(file => !fs.existsSync(file));
    
    if (missing.length === 0) {
      return { status: 'pass', message: 'Configuração Docker completa' };
    } else {
      return { status: 'warning', message: `Arquivos Docker faltando: ${missing.join(', ')}` };
    }
  }

  // Teste 6: Verificar scripts de deploy
  async testDeployScripts() {
    const deployFiles = [
      'deploy.sh',
      'deploy.ps1',
      'env-setup.js'
    ];

    const existing = deployFiles.filter(file => fs.existsSync(file));
    
    if (existing.length >= 2) {
      return { status: 'pass', message: `Scripts de deploy disponíveis: ${existing.join(', ')}` };
    } else {
      return { status: 'warning', message: 'Poucos scripts de deploy disponíveis' };
    }
  }

  // Teste 7: Verificar configuração de segurança
  async testSecurityConfig() {
    const securityFiles = [
      'server/middleware/security.js',
      'server/config/security.js'
    ];

    const missing = securityFiles.filter(file => !fs.existsSync(file));
    
    if (missing.length === 0) {
      return { status: 'pass', message: 'Configurações de segurança implementadas' };
    } else {
      return { status: 'fail', message: `Arquivos de segurança faltando: ${missing.join(', ')}` };
    }
  }

  // Teste 8: Verificar build do frontend
  async testFrontendBuild() {
    try {
      log.info('Executando build do frontend...');
      process.chdir('frontend');
      
      // Verificar se node_modules existe
      if (!fs.existsSync('node_modules')) {
        execSync('npm install', { stdio: 'pipe' });
      }
      
      // Executar build
      execSync('npm run build', { stdio: 'pipe' });
      
      // Verificar se dist foi criado
      const buildExists = fs.existsSync('dist') && fs.existsSync('dist/index.html');
      
      process.chdir('..');
      
      if (buildExists) {
        return { status: 'pass', message: 'Build do frontend executado com sucesso' };
      } else {
        return { status: 'fail', message: 'Build do frontend falhou - dist não criado' };
      }
    } catch (error) {
      process.chdir('..');
      return { status: 'fail', message: `Erro no build do frontend: ${error.message}` };
    }
  }

  // Teste 9: Verificar configuração do banco de dados
  async testDatabaseConfig() {
    const schemaFile = 'server/prisma/schema.prisma';
    
    if (!fs.existsSync(schemaFile)) {
      return { status: 'fail', message: 'Schema do Prisma não encontrado' };
    }

    const schemaContent = fs.readFileSync(schemaFile, 'utf8');
    
    // Verificar se tem modelos essenciais
    const requiredModels = ['User', 'Machine'];
    const missingModels = requiredModels.filter(model => 
      !schemaContent.includes(`model ${model}`)
    );

    if (missingModels.length === 0) {
      return { status: 'pass', message: 'Schema do banco de dados configurado' };
    } else {
      return { status: 'fail', message: `Modelos faltando no schema: ${missingModels.join(', ')}` };
    }
  }

  // Teste 10: Verificar configuração de CI/CD
  async testCICD() {
    const cicdFile = '.github/workflows/deploy.yml';
    
    if (!fs.existsSync(cicdFile)) {
      return { status: 'warning', message: 'Workflow de CI/CD não configurado' };
    }

    const workflowContent = fs.readFileSync(cicdFile, 'utf8');
    
    if (workflowContent.includes('build') && workflowContent.includes('deploy')) {
      return { status: 'pass', message: 'Workflow de CI/CD configurado' };
    } else {
      return { status: 'warning', message: 'Workflow de CI/CD incompleto' };
    }
  }

  // Executar todos os testes
  async runAllTests() {
    log.header('TESTE DE CONFIGURAÇÃO DE PRODUÇÃO');
    
    await this.runTest('Arquivos Essenciais', () => this.testEssentialFiles());
    await this.runTest('Configuração de Ambiente', () => this.testEnvironmentConfig());
    await this.runTest('Dependências do Servidor', () => this.testServerDependencies());
    await this.runTest('Dependências do Frontend', () => this.testFrontendDependencies());
    await this.runTest('Configuração Docker', () => this.testDockerConfig());
    await this.runTest('Scripts de Deploy', () => this.testDeployScripts());
    await this.runTest('Configuração de Segurança', () => this.testSecurityConfig());
    await this.runTest('Build do Frontend', () => this.testFrontendBuild());
    await this.runTest('Configuração do Banco', () => this.testDatabaseConfig());
    await this.runTest('CI/CD', () => this.testCICD());

    this.showResults();
  }

  // Mostrar resultados finais
  showResults() {
    log.header('RESULTADOS DOS TESTES');
    
    console.log(`${colors.green}✅ Passou: ${this.results.passed}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Avisos: ${this.results.warnings}${colors.reset}`);
    console.log(`${colors.red}❌ Falhou: ${this.results.failed}${colors.reset}`);
    
    const total = this.results.passed + this.results.warnings + this.results.failed;
    const score = Math.round((this.results.passed / total) * 100);
    
    console.log(`\n${colors.cyan}📊 Score de Produção: ${score}%${colors.reset}`);
    
    if (score >= 90) {
      log.success('Sistema pronto para produção! 🚀');
    } else if (score >= 70) {
      log.warning('Sistema quase pronto. Corrija os problemas encontrados.');
    } else {
      log.error('Sistema não está pronto para produção. Muitos problemas encontrados.');
    }

    // Mostrar recomendações
    if (this.results.failed > 0) {
      console.log(`\n${colors.magenta}🔧 AÇÕES RECOMENDADAS:${colors.reset}`);
      this.results.tests
        .filter(test => test.status === 'fail')
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.message}`);
        });
    }
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const tester = new ProductionTester();
  tester.runAllTests().catch(error => {
    log.error(`Erro durante os testes: ${error.message}`);
    process.exit(1);
  });
}

module.exports = ProductionTester;