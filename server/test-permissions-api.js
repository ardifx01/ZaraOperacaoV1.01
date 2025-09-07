async function testPermissionsAPI() {
  try {
    // Primeiro fazer login para obter o token
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'lucas.salviano@hotmail.com',
        password: '123456'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response status:', loginResponse.status);
    console.log('Login data:', JSON.stringify(loginData, null, 2));
    
    if (!loginData.success || !loginData.data.user) {
      throw new Error('Login falhou: ' + JSON.stringify(loginData));
    }
    
    const token = loginData.data.token;
    const userId = loginData.data.user.id;
    
    console.log('Login realizado com sucesso');
    console.log('Token:', token);
    console.log('User ID:', userId);
    
    // Agora testar a API de permissões
    const permissionsResponse = await fetch(`http://localhost:3001/api/permissions?userId=${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const permissionsData = await permissionsResponse.json();
    
    console.log('Resposta da API de permissões:');
    console.log('Status:', permissionsResponse.status);
    console.log('Data:', JSON.stringify(permissionsData, null, 2));
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

testPermissionsAPI();