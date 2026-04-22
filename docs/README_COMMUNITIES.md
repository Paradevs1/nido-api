# Comunidades — Nova Funcionalidade

## O que e

Comunidades e um novo espaco dentro da plataforma Bounties onde **Hosts** (marcas e empresas) podem criar grupos exclusivos para se conectar com **Creators** (influenciadores). Dentro de cada comunidade, o Host pode publicar avisos, conversar via chat em grupo e lancar campanhas exclusivas para os membros.

---

## Como funciona

### Para o Host

1. **Cria uma comunidade** com nome, descricao, regras, logo e plataformas obrigatorias (Instagram, TikTok, YouTube, Telegram, Discord)
2. **Recebe solicitacoes** de Creators que querem participar
3. **Aprova ou rejeita** cada solicitacao — so creators com as plataformas exigidas podem solicitar
4. **Publica avisos** para manter os membros informados (com texto, imagens e links)
5. **Conversa no chat** em grupo com todos os membros aprovados
6. **Cria campanhas exclusivas** visiveis apenas para os membros da comunidade
7. **Modera o chat** — pode deletar qualquer mensagem
8. **Edita ou exclui** a comunidade (so pode excluir se nao tiver membros ativos nem campanhas ativas)

### Para o Creator

1. **Explora comunidades** disponiveis — ve nome, descricao, logo, quantidade de membros e plataformas exigidas
2. **Solicita entrada** — se tiver as plataformas exigidas configuradas no perfil, envia solicitacao
3. **Aguarda aprovacao** do Host
4. **Apos aprovado**: acessa avisos, participa do chat, visualiza e participa de campanhas exclusivas
5. **Se rejeitado**: pode solicitar novamente
6. **No chat**: envia mensagens e pode deletar apenas as proprias

### Para o Admin

1. **Visao completa** de todas as comunidades da plataforma
2. **Ve detalhes** de qualquer comunidade: membros, campanhas, avisos, dados do host
3. **Remove membros** de qualquer comunidade
4. **Quantidade de membros pendentes** em destaque

---

## Plataformas obrigatorias

O Host pode definir quais plataformas sociais os Creators precisam ter no perfil para participar da comunidade:

- Instagram
- TikTok
- YouTube
- Telegram
- Discord

Se o Creator nao tem a plataforma configurada, o sistema bloqueia a solicitacao e informa quais estao faltando.

---

## Campanhas exclusivas

- O Host pode criar campanhas dentro da comunidade — mesmas funcionalidades de uma campanha normal
- Essas campanhas **nao aparecem na listagem publica** — sao visiveis apenas para membros aprovados
- O Host ve metricas de cada campanha (total de submissoes)
- O Creator ve as campanhas mas **sem metricas**
- Para submeter a uma campanha de comunidade, o Creator precisa ser membro aprovado

---

## Avisos

- O Host publica avisos com titulo, descricao, imagens (ate 5) e link opcional
- Todos os membros aprovados podem ver os avisos
- O Host pode editar e deletar avisos

---

## Chat em grupo

- Espaco de conversa entre o Host e todos os membros aprovados
- O Host aparece com o nome e logo da empresa
- Os Creators aparecem com username e foto do perfil
- O Host pode moderar deletando qualquer mensagem
- Creators podem deletar apenas suas proprias mensagens

---

## Protecoes e regras

- Creators so acessam o conteudo da comunidade (chat, avisos, campanhas) apos serem **aprovados**
- Um Creator nao pode solicitar entrada duas vezes — precisa aguardar resposta ou ser rejeitado primeiro
- A comunidade so pode ser excluida se **nao tiver membros ativos** e **nao tiver campanhas ativas**
- Hosts so gerenciam suas proprias comunidades — nao podem ver/editar comunidades de outros Hosts
- Ao excluir uma comunidade, todos os avisos, mensagens e membros pendentes/rejeitados sao removidos automaticamente

---

## Atualizacao de perfil do Creator

- Creators agora podem informar seu **Twitter/X** no perfil, junto com as demais plataformas (Instagram, TikTok, YouTube, Telegram, Discord)
- Essa informacao fica disponivel tanto no perfil quanto para o Host ao visualizar membros da comunidade

---

## Melhorias adicionais incluidas

- **Campanhas de comunidade isoladas**: nao aparecem na listagem publica de campanhas, mantendo a exclusividade
- **Validacao de wallet**: corrigido o erro ao inserir wallet quando o usuario participa de campanha em "waiting payment" — agora so bloqueia alteracao se ja tinha wallet configurada anteriormente
- **Metricas no Admin**: endpoints de admin agora retornam dados do Host vinculado a cada campanha
- **Insights de Creators**: novo campo com estatisticas de quantos creators tem cada plataforma configurada
- **Creators recorrentes**: filtro por tipo de campanha (publica/privada) e ordenacao da mais recente para mais antiga
