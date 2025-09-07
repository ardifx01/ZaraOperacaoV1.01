#!/usr/bin/env node

/**
 * Script para migrar dados do SQLite (desenvolvimento) para PostgreSQL (produção)
 * 
 * Uso:
 * 1. Configure DATABASE_URL no .env para PostgreSQL
 * 2. Execute: node migrate-to-production.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Cliente para SQLite (desenvolvimento)
const sqliteClient = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db'
    }
  }
});

// Cliente para PostgreSQL (produção)
const postgresClient = new PrismaClient();

async function migrateData() {
  try {
    console.log('🚀 Iniciando migração de dados...');

    // 1. Migrar usuários
    console.log('📊 Migrando usuários...');
    const users = await sqliteClient.user.findMany();
    for (const user of users) {
      await postgresClient.user.upsert({
        where: { email: user.email },
        update: user,
        create: user
      });
    }
    console.log(`✅ ${users.length} usuários migrados`);

    // 2. Migrar máquinas
    console.log('🏭 Migrando máquinas...');
    const machines = await sqliteClient.machine.findMany();
    for (const machine of machines) {
      await postgresClient.machine.upsert({
        where: { code: machine.code },
        update: machine,
        create: machine
      });
    }
    console.log(`✅ ${machines.length} máquinas migradas`);

    // 3. Migrar testes de qualidade
    console.log('🔬 Migrando testes de qualidade...');
    const qualityTests = await sqliteClient.qualityTest.findMany();
    for (const test of qualityTests) {
      await postgresClient.qualityTest.upsert({
        where: { id: test.id },
        update: test,
        create: test
      });
    }
    console.log(`✅ ${qualityTests.length} testes de qualidade migrados`);

    // 4. Migrar mudanças de teflon
    console.log('🔄 Migrando mudanças de teflon...');
    const teflonChanges = await sqliteClient.teflonChange.findMany();
    for (const change of teflonChanges) {
      await postgresClient.teflonChange.upsert({
        where: { id: change.id },
        update: change,
        create: change
      });
    }
    console.log(`✅ ${teflonChanges.length} mudanças de teflon migradas`);

    // 5. Migrar notificações
    console.log('🔔 Migrando notificações...');
    const notifications = await sqliteClient.notification.findMany();
    for (const notification of notifications) {
      await postgresClient.notification.upsert({
        where: { id: notification.id },
        update: notification,
        create: notification
      });
    }
    console.log(`✅ ${notifications.length} notificações migradas`);

    console.log('🎉 Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  } finally {
    await sqliteClient.$disconnect();
    await postgresClient.$disconnect();
  }
}

// Função para backup do banco SQLite
async function backupSqliteDb() {
  const backupPath = path.join(__dirname, 'prisma', `backup-${Date.now()}.db`);
  const originalPath = path.join(__dirname, 'prisma', 'dev.db');
  
  if (fs.existsSync(originalPath)) {
    fs.copyFileSync(originalPath, backupPath);
    console.log(`💾 Backup criado: ${backupPath}`);
  }
}

// Função principal
async function main() {
  console.log('🔄 Preparando migração para produção...');
  
  // Verificar se DATABASE_URL está configurada
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('sqlite')) {
    console.error('❌ Configure DATABASE_URL para PostgreSQL no arquivo .env');
    console.log('Exemplo: DATABASE_URL="postgresql://user:password@host:port/database"');
    process.exit(1);
  }

  // Fazer backup do SQLite
  await backupSqliteDb();

  // Executar migração
  await migrateData();

  console.log('\n📋 Próximos passos:');
  console.log('1. Verifique os dados migrados');
  console.log('2. Teste a aplicação com PostgreSQL');
  console.log('3. Configure o deploy em produção');
  console.log('4. Atualize as variáveis de ambiente');
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { migrateData, backupSqliteDb };