# Plano de Execução — Dia 2 do Village (09 → 10/06)

> Continuação de `PLANO_ATE_VILLAGE.md`. Meta: stack **NIDO Stellar** no ar, polida e **demo-ready**, com o demo de escrow ensaiado e à prova de falha.
> Hoje: 09/06 (estamos no Village) · Prazo: **finalizar e polir tudo até 10/06**.

---

## Estado real hoje (verificado em 09/06, manhã)

| Item | Status | Evidência |
|---|---|---|
| Back v2.0.0 ("saindo do BETA") no **código** | ✅ feito | `package.json` + `/health` retornam `2.0.0` |
| Front fora do BETA | ✅ feito | `BetaBadge` retorna `null`; rebrand NIDO aplicado nas strings visíveis |
| Front API base por env | ✅ feito | usa `NEXT_PUBLIC_API_URL` |
| **Back DEPLOYADO** | ❌ **stale** | raw Railway responde **1.0.0** + `"Bounties API is working!"` — o código 2.0.0/NIDO **não está no ar** |
| **`stellar.nido.global` / `api.stellar.nido.global`** | ❌ **não resolvem** | stack isolada NIDO Stellar **não subiu** (Bloco B do plano anterior não aconteceu) |
| Fallback default do front | ⚠️ cosmético | ainda `bounties-api.vercel.app` (env sobrescreve em prod) |
| Working tree `nido-api` | ⚠️ não commitado | README, swagger, seed, models de ledger, EmailService, docs |

**Leitura:** o trabalho de **código** está ~pronto. O gargalo é **infra + deploy + ensaio**. O demo roda na stack isolada que **ainda não existe** — esse é o risco #1.

---

## Critical path (do gargalo pro polish)

```
[VOCÊ] Bloco B — subir a stack isolada no Railway (mongo + back + front) + envs
            │
[VOCÊ] GoDaddy — CNAMEs stellar / api.stellar  →  (propagação DNS + TLS ~min)
            │
[EU] Verificar cadeia verde (health 2.0.0, CORS, front→back→mongo)
            │
[EU+VOCÊ] Seed + ensaio do fluxo de escrow ao vivo (runbook)
            │
[EU+VOCÊ] Polish final + ensaio do pitch
```

Sem o Bloco B, **nada do demo ao vivo funciona**. Prioridade absoluta hoje.

---

## Bloco A — EU faço agora (sem bloqueio de infra)

| # | Tarefa | Entrega |
|---|---|---|
| A1 | Commitar o working tree do `nido-api` (v2.0.0, rebrand, swagger, seed, docs) na `feat/stellar-integration` | Código pronto pra deploy — sem isso o Railway sobe o stale |
| A2 | Trocar o fallback default do front de `bounties-api.vercel.app` → `https://api.stellar.nido.global` | Front nunca cai em URL "Bounties" mesmo se a env faltar |
| A3 | Rodar a suíte do back (`npm test`) e do front (Vitest) | Prova das suítes verdes ("impecável") |
| A4 | Revisar/ajustar `scripts/seed-demo-campaign.ts` pro Mongo novo | Cenário de demo redondo |
| A5 | Confirmar runbook de demo (cliques + falas) ainda bate com a UI atual | Roteiro à prova de falha |

## Bloco B — VOCÊ faz (infra; só você tem acesso) — **PRIORIDADE #1**

| # | Tarefa |
|---|---|
| B1 | Railway: projeto + serviço **Mongo** (gera `MONGO_URL` interna) |
| B2 | Railway: serviço **back** — deploy da `feat/stellar-integration` + envs (`MONGODB_URI` interno, `CORS_ALLOWED_ORIGINS=https://stellar.nido.global,http://localhost:3000`, `NODE_ENV=production`, chaves Stellar/Treasury/Arbiter, `SEED_SECRET`, `STELLAR_NETWORK`) + domínio `api.stellar.nido.global` |
| B3 | Railway: serviço **front** — `NEXT_PUBLIC_API_URL=https://api.stellar.nido.global` + domínio `stellar.nido.global` |
| B4 | GoDaddy: 2 CNAMEs (`stellar` → front, `api.stellar` → back) |

## Bloco C — EU faço depois que B subir

| # | Tarefa |
|---|---|
| C1 | `api.stellar.nido.global/health` retorna **2.0.0** (confirma deploy do código novo, não o stale) + preflight CORS de `stellar.nido.global` |
| C2 | Cadeia front → back → mongo (login demo, listar campanha) |
| C3 | Seed do Mongo novo + smoke test do escrow (create → fund → release/dispute) |

---

## Decisão pendente — definir ANTES do demo: mainnet ou testnet ao vivo?

(herdada do `RUNBOOK_DEMO_VILLAGE.md`) — **recomendação:** rodar o demo ao vivo em **testnet** (zero risco, repetível) e **apontar a prova de mainnet gravada** (5 escrows reais, 50 USDC, hashes no StellarExpert) como evidência. Define `STELLAR_NETWORK` no Railway de acordo. Narrativa fala de "USDC on-chain" sem destacar a rede.

---

## Cronograma sugerido

**Hoje (09/06):**
- VOCÊ: **B1–B3** (subir os 3 serviços + envs) o quanto antes — é o gargalo.
- EU: A1–A5 em paralelo (commit, fallback, testes, seed, runbook).

**Amanhã cedo (10/06):**
- VOCÊ: **B4** (CNAMEs na GoDaddy) logo cedo — dá tempo de propagar + TLS.
- EU: C1–C3 assim que os domínios responderem.
- EU+VOCÊ: ensaio do demo ao vivo (runbook) + polish final.

---

## Fora de escopo (não bloqueiam o demo)

- Submissão SCF Build Award (~US$ 70k) e pitch deck — trilha paralela.
- Iniciativa "Saldo do Host + Campanha por Aceitação" — arquitetura documentada, implementação pós-Village (models `HostWallet`/`LedgerEntry` já no working tree, ainda não fiados).
- Migração da chave do Arbiter pra KMS/HSM — roadmap de hardening (uso do SCF).
- Limpeza dos identificadores internos `Bounties` no front (`mockBounties` etc.) — não aparecem na UI.
