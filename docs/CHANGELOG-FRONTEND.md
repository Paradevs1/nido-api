# Alterações Backend — Notas para o Frontend

**Data:** 2026-03-31

---

## 1. Taxa de ativação de campanha: 10% → 12%

A taxa padrão (plano BASIC) para ativar campanhas foi alterada de **10%** para **12%**.

- Plano **CORE** mantém taxas escalonadas (6%, 5%, 3%)
- Plano **ENTERPRISE** mantém taxa 0%
- **Impacto no front:** atualizar qualquer texto/UI que exiba "10%" para "12%"

---

## 2. Host cria conta com status "inactive"

Ao registrar (`POST /api/auth/register-host`), o host agora recebe `status: "inactive"` por padrão. O admin precisa ativar manualmente.

### Novo campo no response de registro e login

```json
{
  "user": {
    "status": "active" | "inactive"
  }
}
```

### Novo campo no JWT

O token agora inclui o campo `status`:

```json
{
  "userId": "...",
  "role": "HOST",
  "status": "active" | "inactive",
  "planId": "...",
  "planName": "BASIC",
  "planExpiresAt": null
}
```

**Impacto no front:**
- Decodificar `status` do JWT para controlar acesso/exibição
- Hosts com `status: "inactive"` devem ver uma tela/mensagem informando que a conta aguarda ativação pelo admin
- O campo só existe para users do tipo `HOST`

---

## 3. Novo endpoint admin — Creators com quantidade de campanhas

```
GET /api/admin/creators/participation-stats?page=1&limit=50&search=username
```

**Response:**
```json
{
  "creators": [
    {
      "id": "userId",
      "username": "nome",
      "twitter_username": "handle",
      "isActive": true,
      "campaigns_participated": 8
    }
  ],
  "total": 100,
  "page": 1,
  "totalPages": 2
}
```

**Query params:**
| Param  | Tipo   | Default | Descrição |
|--------|--------|---------|-----------|
| page   | number | 1       | Página |
| limit  | number | 50      | Itens por página (máx. 100) |
| search | string | —       | Filtro por username ou twitter_username |

---

## 4. Novo endpoint admin — Creators recorrentes

Retorna creators que participaram de **todas** as últimas N campanhas.

```
GET /api/admin/creators/recurring?page=1&limit=50&search=username&lastN=5
```

**Response:**
```json
{
  "creators": [
    {
      "id": "userId",
      "username": "nome",
      "twitter_username": "handle",
      "isActive": true,
      "campaigns_participated": 5
    }
  ],
  "last_campaigns": [
    { "id": "campaignId", "title": "Campaign Title", "created_at": "2026-03-31T00:00:00Z" }
  ],
  "window_campaigns": 5,
  "total": 10,
  "page": 1,
  "totalPages": 1
}
```

**Query params:**
| Param  | Tipo   | Default | Descrição |
|--------|--------|---------|-----------|
| page   | number | 1       | Página |
| limit  | number | 50      | Itens por página (máx. 100) |
| search | string | —       | Filtro por username ou twitter_username |
| lastN  | number | 5       | Quantidade de campanhas recentes a considerar (máx. 50) |

---

## 5. Novo endpoint admin — Ativar/Inativar Host

```
PATCH /api/admin/host/:userId/status
```

**Body:**
```json
{
  "status": "active" | "inactive"
}
```

**Response (200):**
```json
{
  "message": "Host account status updated",
  "status": "active"
}
```

**Erros:**
| Status | Mensagem |
|--------|----------|
| 400    | Only HOST users have account status |
| 404    | User not found |

---

## 6. Cron Job — Remoção de hosts inativos

Job automático que roda **todo sábado às 00:00**.

- Remove usuários do tipo `HOST` com `status: "inactive"` criados há mais de **14 dias**
- **Sem impacto no front** — apenas limpeza de dados no backend
