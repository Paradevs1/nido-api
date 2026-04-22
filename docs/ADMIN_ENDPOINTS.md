# Endpoints Admin – Documentação para o Frontend

Todos os endpoints abaixo exigem **autenticação de usuário ADMIN**. Enviar o token no header:

```
Authorization: Bearer <token>
```

**Base URL:** `{API_BASE}/api/admin`

---

## 1. Creators

### GET /api/admin/creators

Lista de creators (usuários tipo CREATOR) com paginação e filtro.

**Query params (opcionais):**

| Parâmetro   | Tipo   | Default | Descrição                                                                 |
|------------|--------|---------|----------------------------------------------------------------------------|
| `page`     | number | 1       | Página                                                                     |
| `limit`    | number | 50      | Itens por página (máx. 100)                                               |
| `search`   | string | -       | Busca em **username** e **twitter_username** (mesmo parâmetro para os dois)|
| `twitter_username` | string | - | Alternativa a `search` (mesmo efeito)                             |
| `username` | string | -       | Alternativa a `search` (mesmo efeito)                             |

**Resposta 200:**

```json
{
  "creators": [
    {
      "twitter_username": "string",
      "twitter_followers_count": 0,
      "total_earnings": 0,
      "wallet_evm": "string",
      "wallet_sui": "string",
      "wallet_sol": "string"
    }
  ],
  "total": 0,
  "page": 1,
  "totalPages": 0
}
```

---

## 2. Hosts

### GET /api/admin/hosts

Lista de hosts com paginação e filtros.

**Query params (opcionais):**

| Parâmetro   | Tipo    | Default | Descrição                          |
|------------|---------|---------|------------------------------------|
| `page`     | number  | 1       | Página                             |
| `limit`    | number  | 50      | Itens por página (máx. 100)        |
| `search`   | string  | -       | Filtro por **name_company** ou **email** |
| `twitter_username` | string | - | Mesmo efeito que `search` (compatibilidade) |
| `isActive` | boolean | -       | `true` = só ativos, `false` = só inativos |

**Resposta 200:**

```json
{
  "hosts": [
    {
      "name_company": "string",
      "email": "string",
      "campaigns_created": 0,
      "plan_name": "BASIC | CORE | ENTERPRISE",
      "duration_plan": "2025-12-31T00:00:00.000Z",
      "isActive": true
    }
  ],
  "total": 0,
  "page": 1,
  "totalPages": 0
}
```

### GET /api/admin/hosts/options

Lista de hosts para **dropdown/combo** (somente hosts ativos).

**Resposta 200:**

```json
[
  { "host_id": "string", "name_company": "string" }
]
```

### PATCH /api/admin/hosts/:hostId/plan

Atualiza o plano do host.

**Path:** `hostId` (ID do usuário host)

**Body:**

```json
{ "plan_id": "ObjectId do plano" }
```

**Resposta 200:**

```json
{ "success": true, "message": "Host plan updated" }
```

**Erros:** 400 (faltando plan_id), 404 (Host ou Plan not found)

### GET /api/plans/list — Lista de planos (usado no updateHostPlan)

Usado para popular o **combo de planos** na tela de atualizar plano do host. Retorna todos os planos com `id` (usar como `plan_id` no body do `PATCH /api/admin/hosts/:hostId/plan`).

**Observação:** Este endpoint está em `/api/plans`, **não** em `/api/admin`. Não exige autenticação (rota pública).

**Resposta 200:**

```json
{
  "message": "Planos recuperados com sucesso",
  "plans": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "BASIC",
      "duration_months": null
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "CORE",
      "duration_months": 3
    },
    {
      "id": "507f1f77bcf86cd799439013",
      "name": "ENTERPRISE",
      "duration_months": null
    }
  ]
}
```

Use o campo `id` de cada plano como valor de `plan_id` no body do **PATCH /api/admin/hosts/:hostId/plan**.

---

## 3. Usuários (detalhe e ativo)

### GET /api/admin/users/:userId

Detalhe completo de um usuário (creator ou host). Não retorna `password_hash`.

**Path:** `userId` (ID do usuário)

**Resposta 200:**

Objeto do usuário (campos do model User) +:

- `id`: string (mesmo que _id em string)
- `payments_count`: number (total de pagamentos)
- `payments_confirmed_count`: number (pagamentos com status confirmed)

**Erro:** 404 User not found

### PATCH /api/admin/users/:userId/active

Ativa ou desativa o usuário.

**Path:** `userId`

**Body:**

```json
{ "isActive": true }
```
ou
```json
{ "isActive": false }
```

**Resposta 200:**

```json
{ "message": "User activated" | "User deactivated", "isActive": true | false }
```

**Erros:** 400 (isActive não boolean), 404 User not found

---

## 4. Pagamentos (auditoria)

### GET /api/admin/payments

Lista **unificada** de pagamentos das quatro fontes, com paginação e filtros. Cada item inclui o campo **`source`** indicando a origem do pagamento:

| source           | Origem (coleção)                |
|------------------|----------------------------------|
| `Winners`        | `payments_winners_campaigns`     |
| `Active Campaign`| `payment_hosts`                  |
| `Refunds`        | `payment_refunds`                |
| `Plans`          | `plan_payments`                  |

**Query params (opcionais):**

| Parâmetro    | Tipo   | Descrição              |
|-------------|--------|------------------------|
| `page`      | number | Default 1              |
| `limit`     | number | Default 50, máx. 100   |
| `userId`    | string | Filtrar por usuário     |
| `campaignId`| string | Filtrar por campanha (tela admin “Pagamentos por campanha”). **Não inclui** origem `Plans` — `plan_payments` não tem `campaignId`. |
| `status`    | string | `pending` \| `confirmed` \| `failed` \| `error` |
| `search`    | string | Busca textual em nome de usuário, empresa e nome da campanha (após enriquecimento) |
| `source`    | string | `Winners` \| `Active Campaign` \| `Refunds` \| `Plans` — restringe a origem na lista unificada |

Com `campaignId` ou `userId`, a API aumenta a janela de leitura nas coleções para permitir **paginação correta** após unir e ordenar por data.

**Resposta 200:**

```json
{
  "payments": [
    {
      "id": "string",
      "source": "Winners | Active Campaign | Refunds | Plans",
      "created_at": "ISO date",
      "_id": "string",
      "userId": "string",
      "campaignId": "string",
      "signature": "string",
      "to": "string",
      "amount": 0,
      "chain": "string",
      "symbol": "string",
      "status": "pending | confirmed | failed",
      "updated_at": "ISO date"
    }
  ],
  "total": 0,
  "page": 1,
  "totalPages": 0
}
```

Os campos além de `id`, `source` e `created_at` variam conforme a origem (Winners, Active Campaign, Refunds ou Plans).

---

## 5. Export Excel

Endpoints que retornam os **mesmos dados** dos listados acima, em arquivo **.xlsx** para download. Resposta com header `Content-Disposition: attachment` e body binário do Excel.

### GET /api/admin/export/campaigns/:campaignId/short-urls

Exporta os dados de **GET /api/admin/campaigns/:campaignId/short-urls** em Excel.

**Path:** `campaignId` (obrigatório)

**Resposta 200:** arquivo `short_urls_{campaignId}.xlsx`  
Colunas: **Twitter Username**, **Short URL**, **Clicks**

**Erros:** 400 (campaignId ausente), 404 Campaign not found

---

### GET /api/admin/export/creators

Exporta os dados de **GET /api/admin/creators** em Excel (todos os creators ou filtrados).

**Query (opcional):** `twitter_username` – filtro por username

**Resposta 200:** arquivo `creators.xlsx`  
Colunas: **Twitter Username**, **Twitter Followers**, **Total Earnings**, **Wallet EVM**, **Wallet SUI**, **Wallet SOL**

---

### GET /api/admin/export/hosts

Exporta os dados de **GET /api/admin/hosts** em Excel.

**Query (opcionais):** `search`, `isActive` (true/false)

**Resposta 200:** arquivo `hosts.xlsx`  
Colunas: **Company**, **Email**, **Campaigns Created**, **Plan**, **Duration Plan**, **Active**

---

### GET /api/admin/export/payments

Exporta os dados de **GET /api/admin/payments** em Excel (lista unificada das 4 fontes).

**Query (opcionais):** `userId`, `campaignId`, `status`

**Resposta 200:** arquivo `payments.xlsx`  
Colunas: **ID**, **Source** (Winners | Active Campaign | Refunds | Plans), **Created At**, **Amount**, **Status**, **User ID**, **Campaign ID**, **To / Wallet**, **Signature**, **Symbol**, **Chain**

---

## 6. Campanhas

### GET /api/admin/campaigns/options

Lista de campanhas para **dropdown/combo**.

**Resposta 200:**

```json
[
  { "id": "campaignId", "name": "Título da campanha" }
]
```

### GET /api/admin/campaigns/counts

Contagem de campanhas **privadas** e **públicas**.

**Resposta 200:**

```json
{
  "private": 0,
  "public": 0,
  "total": 0
}
```

### GET /api/admin/campaigns/:campaignId/short-urls

Short URLs dos creators por campanha (links encurtados + cliques).

**Path:** `campaignId`

**Resposta 200:**

```json
{
  "campaignTitle": "Nome da campanha",
  "items": [
    {
      "twitter_username": "string",
      "shortURL": "string",
      "clicks": 0
    }
  ]
}
```

**Erro:** 404 Campaign not found

### GET /api/admin/campaign-stats/:campaignId

Estatísticas da campanha (views, likes, retweets, replies, total de submissões, vencedores).

**Path:** `campaignId`

**Resposta 200:**

```json
{
  "views_twitter": 0,
  "likes_twitter": 0,
  "retweets_twitter": 0,
  "replies_twitter": 0,
  "total_submissions": 0,
  "winners": [
    { "username": "string", "amount_received": 0 }
  ]
}
```

---

## Resumo rápido (para o front)

| Método | Path | Uso |
|--------|------|-----|
| GET | `/api/admin/creators` | Lista creators (filtro: search, page, limit) |
| GET | `/api/admin/hosts` | Lista hosts (filtro: search, isActive, page, limit) |
| GET | `/api/admin/hosts/options` | Combo de hosts (host_id, name_company) |
| PATCH | `/api/admin/hosts/:hostId/plan` | Atualizar plano (body: `{ plan_id }`) |
| GET | `/api/admin/users/:userId` | Detalhe do usuário |
| PATCH | `/api/admin/users/:userId/active` | Ativar/desativar (body: `{ isActive }`) |
| GET | `/api/admin/payments` | Lista unificada de pagamentos (Winners, Active Campaign, Refunds, Plans; filtro: userId, campaignId, status) |
| GET | `/api/admin/campaigns/options` | Combo de campanhas (id, name) |
| GET | `/api/admin/campaigns/counts` | Contagem private/public/total |
| GET | `/api/admin/campaigns/:campaignId/short-urls` | Short URLs por campanha |
| GET | `/api/admin/export/campaigns/:campaignId/short-urls` | Export Excel – Short URLs da campanha |
| GET | `/api/admin/export/creators` | Export Excel – Creators (query: twitter_username) |
| GET | `/api/admin/export/hosts` | Export Excel – Hosts (query: search, isActive) |
| GET | `/api/admin/export/payments` | Export Excel – Pagamentos (query: userId, campaignId, status) |
| GET | `/api/admin/campaign-stats/:campaignId` | Stats da campanha |
| GET | `/api/plans/list` | Lista de planos (combo para updateHostPlan; **rota pública**, não exige auth admin) |

**Autenticação:** em todas as requisições de `/api/admin` enviar header `Authorization: Bearer <token>` com usuário **ADMIN**. Respostas 401/403 em caso de token inválido ou sem permissão. O endpoint **GET /api/plans/list** é público e não exige token.
