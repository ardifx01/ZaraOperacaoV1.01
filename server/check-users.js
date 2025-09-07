const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('👥 Verificando usuários no banco de dados...');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true
      },
      orderBy: {
        role: 'asc'
      }
    });
    
    console.log('\n📋 Usuários encontrados:');
    users.forEach(user => {
      const status = user.isActive ? '✅ Ativo' : '❌ Inativo';
      console.log(`ID: ${user.id} | ${user.email} | ${user.name} | ${user.role} | ${status}`);
    });
    
    console.log('\n📊 Resumo por role:');
    const roleCount = {};
    users.forEach(user => {
      roleCount[user.role] = (roleCount[user.role] || 0) + 1;
    });
    
    Object.entries(roleCount).forEach(([role, count]) => {
      console.log(`${role}: ${count} usuário(s)`);
    });
    
    // Verificar se existem usuários com os roles necessários para notificações
    const requiredRoles = ['MANAGER', 'LEADER', 'ADMIN'];
    console.log('\n🔍 Verificando roles necessários para notificações:');
    
    requiredRoles.forEach(role => {
      const usersWithRole = users.filter(u => u.role === role && u.isActive);
      if (usersWithRole.length > 0) {
        console.log(`✅ ${role}: ${usersWithRole.length} usuário(s) ativo(s)`);
        usersWithRole.forEach(user => {
          console.log(`   - ${user.name} (${user.email})`);
        });
      } else {
        console.log(`❌ ${role}: Nenhum usuário ativo encontrado`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar usuários:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();