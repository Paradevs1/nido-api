# Decisão de Deploy — Stack NIDO Stellar (Railway + GoDaddy)

> Status: **Aprovado** · Data: 2026-06-08 · Builder: Gustavo Fontes (`f0ntz`)
> Contexto: camada que será apresentada no **Stellar Village / demo-day / pitch para investidores**.

---

## Decisão

O demo-day/pitch roda numa **stack "NIDO Stellar" isolada no Railway** — front, back e Mongo num único projeto Railway, **separada do produto principal `nido.global`** (que segue na Vercel). Os domínios públicos são amarrados via **GoDaddy** (DNS do `nido.global`).

| Componente | Domínio / Acesso | Onde |
|---|---|---|
| Front (Next.js) | `stellar.nido.global` | Railway (serviço front) |
| Back (este repo, `nido-api`) | `api.stellar.nido.global` | Railway (serviço back) |
| Banco (MongoDB) | rede privada interna (`*.railway.internal`) — **sem domínio público** | Railway (serviço Mongo) |

### Por que assim

- **Isolamento total** do produto em produção (`nido.global`/Vercel): zero risco de regressão na operação atual durante o Village.
- **Banco na rede privada do Railway:** o Mongo não tem porta pública, ninguém de fora alcança o banco. Só front e back têm domínio. Padrão de segurança correto.
- **Domínio NIDO premium:** `stellar.nido.global` é temático pro Village e 100% sob a marca — sinaliza empresa, não projeto de hackathon.
- **Uma camada só pra mostrar:** front + back + db conectados no mesmo lugar, fácil de operar e demonstrar ao vivo.

---

## Arquitetura

```
                    GoDaddy (DNS do nido.global)
                            │
          ┌─────────────────┴─────────────────┐
          │ CNAME stellar      CNAME api.stellar│
          ▼                                     ▼
┌──────────────────────  Projeto Railway  ──────────────────────┐
│                                                                │
│   stellar.nido.global ──► Serviço FRONT (Next.js)              │
│                              │  chama a API                    │
│                              ▼                                  │
│   api.stellar.nido.global ─► Serviço BACK (este repo)          │
│                              │  MONGODB_URI interno             │
│                              ▼                                  │
│   (sem domínio público) ───► Serviço MONGO (rede privada)      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Passo a passo de setup

**1. Railway — Mongo:** adicionar o serviço MongoDB no projeto. Ele gera uma `MONGO_URL` interna.

**2. Railway — Back (`nido-api`):** setar as envs:
- `MONGODB_URI` = URL **interna** do Mongo (`mongodb://...railway.internal:27017/...`)
- `CORS_ALLOWED_ORIGINS=https://stellar.nido.global,http://localhost:3000`
- `NODE_ENV=production` + demais envs (Stellar, Treasury, Arbiter, etc.)
- Custom Domain → `api.stellar.nido.global` → Railway devolve um alvo CNAME.

**3. Railway — Front:** setar `NEXT_PUBLIC_API_URL=https://api.stellar.nido.global` (ou a env de API base que o front usa) e Custom Domain → `stellar.nido.global` → Railway devolve outro alvo CNAME.

**4. GoDaddy — DNS** (2 registros CNAME):

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| CNAME | `stellar` | `<alvo do FRONT no Railway>` | 600 |
| CNAME | `api.stellar` | `<alvo do BACK no Railway>` | 600 |

**5. Verificação:** testar `api.stellar.nido.global/health`, o preflight CORS a partir de `stellar.nido.global`, e a cadeia front → back → mongo. (O TLS do Railway leva alguns minutos pra emitir após o CNAME propagar.)

---

## Pendências relacionadas

- **Seed do banco novo:** o Mongo dessa stack sobe vazio. Pra demo com dados (campanhas, escrows), semear via scripts `seed-*` / rota `/api/seed` (`SEED_SECRET`). Montar um cenário de demo redondo.
- **API base do front:** o front hoje aponta pra URL crua `nido-api-production-1cc3.up.railway.app`; migrar `NEXT_PUBLIC_API_URL` para `https://api.stellar.nido.global`.
- **Versão "saindo do BETA":** avaliar bump de `1.0.0` → `2.0.0` (`package.json` / `/health` / swagger) como marco.

## NÃO mexer (identificadores de runtime, não marca)

- JWT `issuer`/`audience` = `bounties-api` / `bounties-users` (trocar invalida todos os JWTs ativos).
- Nome do banco Mongo = `bounties` (trocar aponta pra banco vazio = aparente perda de dados).

A migração de marca Bounties → NIDO já foi aplicada em todas as strings públicas (resposta raiz da API, e-mails, swagger, README, `package.json`).
