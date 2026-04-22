// Script de exemplo para testar a API
// Execute: node test-api.js

const baseUrl = 'http://localhost:3000/api';

// Função para fazer requisições
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

// Testes da API
async function testAPI() {
  await makeRequest('http://localhost:3000/');

  const newBounty = {
    title: 'Implementar autenticação JWT',
    description: 'Adicionar sistema de autenticação com JWT para a API',
    reward: 1000,
    currency: 'BRL',
    category: 'feature',
    difficulty: 'medium',
    tags: ['backend', 'security', 'jwt'],
    creator: 'admin@empresa.com',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 dias
  };

  const createdBounty = await makeRequest(`${baseUrl}/bounties`, {
    method: 'POST',
    body: JSON.stringify(newBounty)
  });

  // 3. Listar todos os bounties
  await makeRequest(`${baseUrl}/bounties`);

  // 4. Buscar bounty por ID (se foi criado)
  if (createdBounty && createdBounty.data && createdBounty.data._id) {
    await makeRequest(`${baseUrl}/bounties/${createdBounty.data._id}`);
  }

  // 5. Atualizar bounty
  if (createdBounty && createdBounty.data && createdBounty.data._id) {
    const updateData = {
      status: 'in_progress',
      assignee: 'dev@empresa.com'
    };
    
    await makeRequest(`${baseUrl}/bounties/${createdBounty.data._id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  // 6. Marcar como concluído
  if (createdBounty && createdBounty.data && createdBounty.data._id) {
    await makeRequest(`${baseUrl}/bounties/${createdBounty.data._id}/complete`, {
      method: 'PUT',
      body: JSON.stringify({
        submissionUrl: 'https://github.com/empresa/projeto/pull/123'
      })
    });
  }

  // 7. Obter estatísticas
  await makeRequest(`${baseUrl}/bounties/stats`);
}

// Executar testes se o script for chamado diretamente
if (require.main === module) {
  testAPI().catch(console.error);
}

module.exports = { testAPI, makeRequest };
