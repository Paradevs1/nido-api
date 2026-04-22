# MISSAO: Desenvolvimento Completo do Frontend — Funcionalidade de Comunidades

## FASE 0 — LEITURA E ENTENDIMENTO DO PROJETO FRONTEND

Antes de escrever qualquer linha de codigo, execute os seguintes passos:

1. Leia todos os arquivos do projeto frontend:
   - Mapeie a estrutura de diretorios completa
   - Identifique o framework (React, Next.js, Vue, etc.) e versoes
   - Identifique a biblioteca de UI (Tailwind, MUI, Chakra, Shadcn, etc.)
   - Identifique o gerenciador de estado (Context, Redux, Zustand, React Query, etc.)
   - Leia como a autenticacao funciona no frontend (token storage, interceptors, guards de rota)
   - Leia os componentes existentes para entender padroes de nomenclatura, estilos e estrutura
   - Identifique como chamadas HTTP sao feitas (axios, fetch wrapper, service layer)
   - Identifique o padrao de rotas do projeto
   - Identifique padrao de paginacao existente (scroll infinito, botoes, load more)
   - Identifique padrao de upload de imagens (como o logo_company e feito hoje)

2. Apos a leitura, produza um relatorio interno com:
   - Stack tecnologica confirmada
   - Padrao arquitetural dos componentes
   - Como tokens JWT sao armazenados e enviados
   - Padrao de tratamento de erro (toasts, modais, inline)
   - Padrao de paginacao

3. So avance para a Fase 1 apos ter certeza absoluta de que entendeu o projeto.

---

## CONTEXTO DO NEGOCIO

A plataforma conecta **Hosts** (marcas/empresas) e **Creators** (influenciadores). Agora foi adicionada a funcionalidade de **Comunidades**, onde Hosts criam comunidades, Creators pedem para entrar, e dentro da comunidade existem: avisos, chat em grupo, e campanhas exclusivas.

### Roles
- **HOST**: cria comunidades, gerencia membros, cria campanhas, publica avisos, modera chat
- **CREATOR**: descobre comunidades, solicita entrada, participa de campanhas exclusivas, interage no chat
- **ADMIN**: supervisao total de todas as comunidades

### Entidades

**Community**
```
id, name, description, rules, logo (base64 image),
required_platforms (array: DISCORD|INSTAGRAM|TIKTOK|YOUTUBE|TELEGRAM),
host_id, members_count, member_status, created_at, updated_at
```

**CommunityMember**
```
id, community_id, creator_id, status (PENDING|APPROVED|REJECTED),
requested_at, reviewed_at, reviewed_by,
creator: { username, twitter_username, username_instagram, username_tiktok,
           username_youtube, username_telegram, username_discord, twitter_profile_image }
```

**CommunityAnnouncement**
```
id, community_id, title, description, image_url (base64 opcional),
created_by, created_at, updated_at
```

**CommunityMessage**
```
id, community_id, sender_id, sender_role (HOST|CREATOR), message, created_at,
sender: {
  username (HOST: name_company || username, CREATOR: username),
  twitter_profile_image (HOST: logo_company || twitter_profile_image, CREATOR: twitter_profile_image)
}
```

---

## FASE 1 — MAPA COMPLETO DE ENDPOINTS

Base URL: `/api`
Autenticacao: header `Authorization: Bearer {token}`

### Comunidades (CRUD)

```
POST   /api/communities                                    → HOST: Criar comunidade
GET    /api/communities                                    → CREATOR: Listar todas comunidades + status de participacao do creator
GET    /api/communities/mine                               → HOST: minhas comunidades criadas | CREATOR: comunidades onde sou membro aprovado
GET    /api/communities/:id                                → HOST dono, ADMIN, CREATOR aprovado: Detalhes com membros, campanhas, avisos
PUT    /api/communities/:id                                → HOST dono: Editar comunidade
DELETE /api/communities/:id                                → HOST dono, ADMIN: Deletar comunidade (cascade)
```

### Membros

```
POST   /api/communities/:id/join                           → CREATOR: Solicitar entrada (valida required_platforms do perfil)
GET    /api/communities/:id/members?status=PENDING|APPROVED|REJECTED → HOST dono, ADMIN: Listar membros com filtro
PATCH  /api/communities/:id/members/:memberId/approve      → HOST dono: Aprovar membro
PATCH  /api/communities/:id/members/:memberId/reject       → HOST dono: Rejeitar membro
DELETE /api/communities/:id/members/:memberId              → HOST dono, ADMIN: Remover membro
```

### Avisos (Announcements)

```
POST   /api/communities/:id/announcements                  → HOST dono: Criar aviso (com ou sem imagem base64)
GET    /api/communities/:id/announcements?page=X&limit=Y   → HOST, ADMIN, CREATOR aprovado: Listar avisos paginados
PUT    /api/communities/:id/announcements/:announcementId  → HOST dono: Editar aviso
DELETE /api/communities/:id/announcements/:announcementId  → HOST dono: Deletar aviso
```

### Chat em Grupo

```
POST   /api/communities/:id/messages                       → HOST dono, CREATOR aprovado: Enviar mensagem
GET    /api/communities/:id/messages?page=X&limit=Y        → HOST, ADMIN, CREATOR aprovado: Listar mensagens paginadas
DELETE /api/communities/:id/messages/:messageId            → HOST (moderacao de qualquer msg), autor (propria msg): Deletar
```

### Campanhas da Comunidade

```
POST   /api/communities/:id/campaigns                      → HOST dono: Criar campanha vinculada (mesmo body de campanha normal)
GET    /api/communities/:id/campaigns?page=X&limit=Y       → HOST (com metricas total_submissions), CREATOR aprovado (sem metricas), ADMIN
```

Obs: campanhas de comunidade NAO aparecem na listagem publica (`GET /api/host/campaigns/public`) nem na listagem do host (`GET /api/host/campaigns`). Sao exclusivas da comunidade.

### Admin

```
GET    /api/admin/communities?page=X&limit=Y               → ADMIN: Todas comunidades com dados do host + contagem membros
GET    /api/admin/communities/:id                          → ADMIN: Detalhes completos (membros, campanhas, avisos, host)
GET    /api/admin/communities/:id/members?page=X&limit=Y   → ADMIN: Todos os membros
```

---

## FASE 2 — FORMATOS DE REQUEST E RESPONSE

### Criar Comunidade

**Request:**
```json
POST /api/communities
{
  "name": "Nome da Comunidade",
  "description": "Descricao detalhada",
  "rules": "1. Regra um\n2. Regra dois",
  "logo": "data:image/png;base64,iVBOR...",
  "required_platforms": ["INSTAGRAM", "TIKTOK"]
}
```
- `name`: obrigatorio, max 200 chars
- `description`: obrigatorio, max 5000 chars
- `rules`: obrigatorio, max 10000 chars
- `logo`: opcional, base64, tipos aceitos: jpg/jpeg/png/webp, max 5MB
- `required_platforms`: opcional, array de: DISCORD, INSTAGRAM, TIKTOK, YOUTUBE, TELEGRAM

**Response (201):**
```json
{
  "success": true,
  "message": "Community created successfully",
  "data": {
    "id": "69cdb6ea8a10d4f489d0d556",
    "name": "Nome da Comunidade",
    "description": "Descricao detalhada",
    "rules": "1. Regra um\n2. Regra dois",
    "logo": "data:image/png;base64,iVBOR...",
    "required_platforms": ["INSTAGRAM", "TIKTOK"],
    "host_id": "69cdb6e7a2c0d557d149ce78",
    "members_count": 0,
    "created_at": "2026-04-02T00:23:08.770Z",
    "updated_at": "2026-04-02T00:23:08.770Z"
  }
}
```

### Editar Comunidade

**Request:**
```json
PUT /api/communities/:id
{
  "name": "Novo nome",
  "description": "Nova descricao",
  "rules": "Novas regras",
  "logo": "data:image/png;base64,...",
  "required_platforms": ["INSTAGRAM", "YOUTUBE"]
}
```
Todos os campos sao opcionais — envia apenas o que quer alterar.

### Listar Comunidades (CREATOR — descoberta)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "69cdb6ea8a10d4f489d0d556",
      "name": "Comunidade QA Alpha",
      "description": "Descricao...",
      "rules": "...",
      "logo": "data:image/png;base64,...",
      "required_platforms": ["INSTAGRAM", "TIKTOK"],
      "host_id": "69cdb6e7a2c0d557d149ce78",
      "members_count": 5,
      "member_status": "APPROVED",
      "created_at": "...",
      "updated_at": "..."
    },
    {
      "id": "...",
      "name": "Outra Comunidade",
      "members_count": 12,
      "member_status": null,
      "required_platforms": null
    }
  ]
}
```
- `member_status`: status do creator logado nessa comunidade — `"APPROVED"`, `"PENDING"`, `"REJECTED"`, ou `null` (nunca solicitou)

### Solicitar Entrada (Join)

**Request:**
```json
POST /api/communities/:id/join
// sem body
```

**Response sucesso (201):**
```json
{
  "success": true,
  "message": "Join request submitted successfully",
  "data": {
    "id": "member-id",
    "community_id": "...",
    "creator_id": "...",
    "status": "PENDING",
    "requested_at": "..."
  }
}
```

**Erro — plataformas faltando (400):**
```json
{
  "message": "You must have the following platforms configured in your profile to join this community: INSTAGRAM, TIKTOK",
  "error": "JOIN_COMMUNITY_ERROR"
}
```

**Erro — duplicata (409):**
```json
{
  "message": "You already have a pending or approved membership for this community",
  "error": "JOIN_COMMUNITY_ERROR"
}
```

### Aprovar / Rejeitar Membro

```
PATCH /api/communities/:id/members/:memberId/approve
PATCH /api/communities/:id/members/:memberId/reject
// sem body
```

**Response (200):**
```json
{
  "success": true,
  "message": "Member approved successfully",
  "data": {
    "id": "member-id",
    "status": "APPROVED",
    "reviewed_at": "...",
    "reviewed_by": "host-id",
    "creator": {
      "username": "creator_um_qa",
      "twitter_username": "@creator_um",
      "username_instagram": "@creator_um_ig",
      "username_tiktok": "@creator_um_tt",
      "username_youtube": "CreatorUmYT",
      "username_telegram": "@creator_tg",
      "username_discord": "creator#1234",
      "twitter_profile_image": "https://..."
    }
  }
}
```

### Listar Membros (HOST/ADMIN)

```
GET /api/communities/:id/members?status=PENDING&page=1&limit=50
```

**Response (200):**
```json
{
  "success": true,
  "members": [...],
  "total": 25,
  "page": 1,
  "totalPages": 1
}
```

### Criar Aviso

**Request:**
```json
POST /api/communities/:id/announcements
{
  "title": "Titulo do Aviso",
  "description": "Conteudo do aviso",
  "image_url": "data:image/jpeg;base64,/9j/4..."
}
```
- `title`: obrigatorio, max 300 chars
- `description`: obrigatorio, max 10000 chars
- `image_url`: opcional, base64, tipos: jpg/jpeg/png/webp, max 5MB

### Enviar Mensagem no Chat

**Request:**
```json
POST /api/communities/:id/messages
{
  "message": "Texto da mensagem"
}
```
- `message`: obrigatorio, max 5000 chars

**Response (201):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "id": "msg-id",
    "community_id": "...",
    "sender_id": "...",
    "sender_role": "HOST",
    "message": "Texto da mensagem",
    "created_at": "...",
    "sender": {
      "username": "Host Alpha Ltda",
      "twitter_profile_image": "data:image/png;base64,..."
    }
  }
}
```

IMPORTANTE sobre o campo `sender`:
- Se o remetente for HOST: `username` = `name_company` (ou username se nao tiver), `twitter_profile_image` = `logo_company` (ou twitter_profile_image se nao tiver)
- Se o remetente for CREATOR: `username` = username normal, `twitter_profile_image` = avatar do twitter

### Listar Mensagens

```
GET /api/communities/:id/messages?page=1&limit=50
```

**Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "id": "...",
      "sender_id": "...",
      "sender_role": "HOST",
      "message": "Ola a todos!",
      "created_at": "...",
      "sender": { "username": "Host Alpha Ltda", "twitter_profile_image": "data:image/png;base64,..." }
    },
    {
      "id": "...",
      "sender_id": "...",
      "sender_role": "CREATOR",
      "message": "Obrigado!",
      "created_at": "...",
      "sender": { "username": "creator_um_qa", "twitter_profile_image": "https://pbs.twimg.com/..." }
    }
  ],
  "total": 2,
  "page": 1,
  "totalPages": 1
}
```

### Criar Campanha na Comunidade

```json
POST /api/communities/:id/campaigns
```
O body e exatamente o mesmo de uma campanha normal (os campos que ja existem no formulario de criar campanha). A API vincula automaticamente o `community_id`. Essas campanhas NAO aparecem na listagem publica de campanhas — sao exclusivas da comunidade.

### Admin — Listar Comunidades

**Response (200):**
```json
{
  "success": true,
  "communities": [
    {
      "id": "...",
      "name": "Comunidade Alpha",
      "members_count": 5,
      "required_platforms": ["INSTAGRAM", "TIKTOK"],
      "host": {
        "username": "host_alpha_qa",
        "email": "host-a@qa-test.com",
        "name_company": "Host Alpha Ltda",
        "logo_company": null
      },
      "created_at": "..."
    }
  ],
  "total": 3,
  "page": 1,
  "totalPages": 1
}
```

### Formato padrao de erros

```json
// 401 - Sem token
{ "message": "Access token not provided", "error": "MISSING_TOKEN" }

// 403 - Sem permissao
{ "message": "Only HOST users can access this resource", "error": "FORBIDDEN" }
{ "message": "You do not have permission to manage this community", "error": "UPDATE_COMMUNITY_ERROR" }
{ "message": "You must be an approved member of this community", "error": "GET_COMMUNITY_ERROR" }

// 404 - Nao encontrado
{ "message": "Community not found", "error": "GET_COMMUNITY_ERROR" }

// 409 - Conflito/duplicata
{ "message": "You already have a pending or approved membership for this community", "error": "JOIN_COMMUNITY_ERROR" }

// 422 - Validacao
{ "message": "Validation error", "error": "VALIDATION_ERROR", "details": ["name: Name is required", "rules: Rules are required"] }

// 400 - Plataformas faltando no join
{ "message": "You must have the following platforms configured in your profile to join this community: INSTAGRAM, TIKTOK", "error": "JOIN_COMMUNITY_ERROR" }
```

---

## FASE 3 — TELAS E COMPONENTES A IMPLEMENTAR

### 3.1 — Visao do HOST

#### Tela: Criar Comunidade
- Formulario: name, description (textarea), rules (textarea), logo (upload com preview), required_platforms (multi-select checkboxes: DISCORD, INSTAGRAM, TIKTOK, YOUTUBE, TELEGRAM)
- Upload de logo: aceitar jpg/jpeg/png/webp, max 5MB, converter para base64, mostrar preview
- Validacao frontend dos campos obrigatorios antes de enviar
- Feedback: toast de sucesso + redirect para detalhes da comunidade
- Botoes com cursor: pointer

#### Tela: Minhas Comunidades (HOST)
- Lista/grid de comunidades com: logo, nome, descricao truncada, contagem de membros, required_platforms como badges
- Botao "Criar Nova Comunidade"
- Click no card → navega para detalhes da comunidade
- Cursor: pointer em cards e botoes

#### Tela: Detalhes da Comunidade (HOST)
- Header: logo, nome, descricao, regras (colapsavel se longo), required_platforms como badges, botoes Editar e Deletar
- Tabs com cursor: pointer:
  - **Membros**: lista com filtro por status (PENDING/APPROVED/REJECTED como tabs), botoes aprovar/rejeitar/remover
  - **Avisos**: lista de avisos com botao criar, editar (icone), deletar (icone)
  - **Chat**: area de mensagens estilo chat, input para enviar, botao deletar em cada msg (moderacao)
  - **Campanhas**: lista de campanhas com total_submissions visivel, botao "Criar Campanha"
- Botao "Voltar" (back) com cursor: pointer

#### Tela: Editar Comunidade
- Mesmo formulario de criar, pre-preenchido com dados atuais
- Botao "Salvar Alteracoes"
- Botao "Voltar" com cursor: pointer

#### Gestao de Membros
- Membros PENDING: mostrar avatar + username + @redes sociais + botoes "Aprovar" (verde) e "Rejeitar" (vermelho)
- Membros APPROVED: mostrar avatar + username + @redes + botao "Remover" (vermelho)
- Membros REJECTED: mostrar avatar + username + status
- Confirmacao antes de rejeitar/remover (modal)
- Cursor: pointer em todos botoes de acao

#### Chat (HOST)
- Mensagens ordenadas por data (mais recente embaixo)
- Cada mensagem: imagem do sender (twitter_profile_image), username, sender_role como badge (HOST/CREATOR), texto, horario
- HOST aparece com nome da empresa e logo_company como avatar
- CREATOR aparece com username e twitter_profile_image como avatar
- Input de texto + botao enviar na parte inferior
- Botao de deletar (icone lixeira) em TODAS as mensagens (host modera)
- Polling a cada 15-30 segundos para novas mensagens

### 3.2 — Visao do CREATOR

#### Tela: Explorar Comunidades
- Lista/grid de todas as comunidades (GET /api/communities)
- Cada card: logo, nome, descricao truncada, members_count, required_platforms como badges
- Status de participacao do creator:
  - `member_status === null`: botao "Solicitar Entrada" (verde)
  - `member_status === "PENDING"`: badge "Aguardando Aprovacao" (amarelo), sem botao
  - `member_status === "APPROVED"`: badge "Membro" (verde), click → detalhes
  - `member_status === "REJECTED"`: badge "Rejeitado" (vermelho), botao "Solicitar Novamente"
- Se community tem required_platforms:
  - Mostrar quais plataformas sao exigidas no card
  - Se o creator NAO tem alguma plataforma no perfil, desabilitar botao e mostrar tooltip: "Voce precisa ter INSTAGRAM, TIKTOK configurados no seu perfil"
  - Se clicar e der erro 400 (plataformas faltando), mostrar toast com a mensagem da API
- Cursor: pointer nos cards e botoes

#### Tela: Minhas Comunidades (CREATOR)
- Lista de comunidades onde o creator e membro aprovado (GET /api/communities/mine)
- Click no card → detalhes da comunidade
- Empty state se nenhuma comunidade: "Voce ainda nao e membro de nenhuma comunidade. Explore comunidades disponiveis!"

#### Tela: Detalhes da Comunidade (CREATOR — membro aprovado)
- Header: logo, nome, descricao, regras
- Secoes:
  - **Avisos**: lista somente leitura (sem botoes de editar/deletar)
  - **Chat**: area de mensagens com input para enviar. Botao deletar SOMENTE na propria mensagem
  - **Campanhas**: lista de campanhas SEM metricas (sem total_submissions)
- Botao "Voltar" com cursor: pointer
- Se creator NAO e membro aprovado e tenta acessar → tela "Acesso Negado" ou redirect

#### Chat (CREATOR)
- Mesma interface do HOST, porem:
  - Botao deletar SOMENTE na propria mensagem (sender_id === userId logado)
  - Nao pode deletar msgs de outros
- Avatar e nome: usa os dados do campo `sender` retornado pela API

### 3.3 — Visao do ADMIN

#### Tela: Listar Comunidades (Admin)
- Tabela/lista: nome, host (nome_company/email), members_count, required_platforms, data criacao
- Paginacao
- Click → detalhes completos

#### Tela: Detalhes da Comunidade (Admin)
- Todas as informacoes: info geral, dados do host, membros (todos status), campanhas, avisos
- pending_members_count em destaque
- Dados do host (username, email, empresa)
- Botao remover membro em qualquer membro
- Cursor: pointer em todos elementos clicaveis

---

## FASE 4 — REGRAS DE NEGOCIO NO FRONTEND

1. **required_platforms no join**: antes de habilitar botao "Solicitar Entrada", verificar se o creator tem as plataformas exigidas no perfil (campos username_instagram, username_tiktok, username_youtube, username_telegram, username_discord). Mostrar quais estao faltando.
2. **Membros PENDING**: creator ve status "Pendente" e NAO pode acessar conteudo da comunidade (chat, avisos, campanhas).
3. **Membros REJECTED**: creator ve status "Rejeitado". Pode tentar solicitar novamente (a API permite re-aplicacao apos rejeicao).
4. **Membros APPROVED**: acesso completo a chat, avisos, campanhas.
5. **Chat — polling**: como a API e HTTP, implementar polling a cada 15-30 segundos para novas mensagens. Limpar interval no unmount do componente para evitar memory leak.
6. **Chat — avatar**: usar `sender.twitter_profile_image` como avatar. HOST mostra logo da empresa, CREATOR mostra foto do twitter. Se nulo, usar avatar placeholder.
7. **Upload de imagens**: converter para base64 antes de enviar. Validar tipo (jpg/jpeg/png/webp) e tamanho (max 5MB) no frontend ANTES de enviar.
8. **Paginacao**: a API retorna `{ total, page, totalPages }`. Implementar conforme padrao do projeto.
9. **Campanhas — visibilidade de metricas**: HOST ve `total_submissions`. CREATOR nao ve.
10. **Campanhas — exclusividade**: campanhas de comunidade NAO aparecem na listagem publica. Sao visiveis apenas dentro da comunidade.
11. **Deletar comunidade**: confirmacao com modal "Tem certeza? Isso ira remover todos os membros, avisos e mensagens."
12. **Deletar mensagem — moderacao**: HOST pode deletar qualquer mensagem. CREATOR so deleta propria mensagem.
13. **Cursor pointer**: todos os botoes, cards clicaveis, tabs, links de navegacao e botoes "Voltar" devem ter `cursor: pointer`.
14. **Criar campanha na comunidade**: usar o mesmo formulario de criacao de campanha existente. A rota e `POST /api/communities/:id/campaigns` com o mesmo body.

---

## FASE 5 — TESTES DO FRONTEND

### Testes unitarios (componentes)
- [ ] Formulario de criar comunidade: valida campos obrigatorios
- [ ] Formulario de criar comunidade: valida formato e tamanho de imagem
- [ ] Formulario de criar comunidade: multi-select de required_platforms funciona
- [ ] Card de comunidade: mostra badge de status correto (Membro, Pendente, Rejeitado, Solicitar)
- [ ] Botao "Solicitar Entrada": desabilitado quando plataformas faltam
- [ ] Botao "Solicitar Entrada": tooltip mostra plataformas faltando
- [ ] Lista de membros: filtro por status (tabs PENDING/APPROVED/REJECTED)
- [ ] Chat: mensagem enviada aparece na lista
- [ ] Chat: avatar correto para HOST (logo_company) e CREATOR (twitter_profile_image)
- [ ] Chat: botao deletar aparece apenas onde permitido (HOST=todas, CREATOR=proprias)
- [ ] Aviso: formulario com e sem imagem
- [ ] Campanhas: HOST ve metricas, CREATOR nao ve
- [ ] Todos botoes, back, tabs tem cursor: pointer

### Testes de integracao (fluxos)
- [ ] Fluxo HOST: criar comunidade → ver na lista → aprovar membro → criar aviso → enviar msg no chat → criar campanha
- [ ] Fluxo CREATOR: explorar comunidades → solicitar entrada → (aprovado) → ver avisos → enviar msg → ver campanhas
- [ ] Fluxo rejeicao: CREATOR solicita → HOST rejeita → CREATOR nao acessa → CREATOR re-solicita
- [ ] Fluxo admin: listar todas → ver detalhes → ver membros → remover membro
- [ ] Protecao de rotas: CREATOR nao aprovado tenta acessar chat → redirect/erro
- [ ] Protecao de rotas: HOST tenta acessar comunidade de outro host → erro
- [ ] Validacao de plataformas: CREATOR sem plataformas exigidas tenta entrar → mensagem clara

### Testes de erro
- [ ] API retorna 401 (token expirado) → redirect para login
- [ ] API retorna 403 → mensagem "Sem permissao"
- [ ] API retorna 404 → tela "Comunidade nao encontrada"
- [ ] API retorna 409 (duplicata join) → mensagem "Voce ja solicitou"
- [ ] API retorna 400 (plataformas faltando) → toast com lista de plataformas
- [ ] API retorna 422 (validacao) → mostrar detalhes dos erros
- [ ] Rede offline / timeout → mensagem amigavel

---

## FASE 6 — AUDITORIA DO FRONTEND

### Acessibilidade
- [ ] Todos os botoes tem texto visivel ou aria-label
- [ ] Formularios tem labels associados aos inputs
- [ ] Badges de status tem contraste suficiente
- [ ] Navegacao por teclado funciona nos modais e tabs
- [ ] Cursor pointer em todos elementos interativos

### Performance
- [ ] Imagens base64 grandes nao sao re-renderizadas desnecessariamente (memo/useMemo)
- [ ] Paginacao evita carregar tudo de uma vez
- [ ] Chat com polling: cleanup do interval no unmount (evitar memory leak)
- [ ] Listas grandes usam virtualizacao se necessario

### Seguranca
- [ ] Token JWT nao e exposto em URLs ou logs
- [ ] Upload de imagem valida tipo MIME no frontend (nao apenas extensao)
- [ ] Inputs de texto sao sanitizados contra XSS
- [ ] Rotas protegidas tem guards no frontend (redirect se role incorreto)
- [ ] Nao confiar apenas no frontend para permissoes (a API ja valida, mas UX deve refletir)

### UX
- [ ] Loading states (spinner/skeleton) em todas as chamadas HTTP
- [ ] Empty states quando listas estao vazias ("Nenhum membro pendente", "Nenhuma comunidade encontrada")
- [ ] Confirmacao antes de acoes destrutivas (deletar comunidade, remover membro, rejeitar membro)
- [ ] Toast/notificacao apos sucesso e erro
- [ ] Responsividade mobile
- [ ] Cursor pointer em TODOS botoes, cards clicaveis, tabs, links de navegacao e botoes "Voltar"

---

## REGRAS GERAIS DE EXECUCAO

- Nunca assuma: leia o arquivo antes de modificar
- Siga os padroes do projeto frontend existente (componentes, estilos, rotas, chamadas HTTP)
- Use os mesmos padroes de chamada HTTP que o projeto ja usa (axios instance, interceptors, etc)
- Trate TODOS os codigos de erro da API (400, 401, 403, 404, 409, 422)
- Implemente loading states e empty states
- Nao adicione dependencias desnecessarias
- Prefira editar/reusar componentes existentes a criar novos quando possivel
- Teste em mobile e desktop
- Cursor pointer e obrigatorio em todo elemento interativo
