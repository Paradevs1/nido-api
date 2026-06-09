# Plano de Execução — até o Stellar Village (08 → 09/06)

> Meta: stack **NIDO Stellar** (`stellar.nido.global` + `api.stellar.nido.global` + Mongo privado) **no ar, polida e demo-ready**, posicionamento saindo do BETA, pronta pro pitch.
> Hoje: 08/06 · Village: 08–11/06 · Objetivo: "quase tudo" pronto até 09/06.

---

## Critical path (a ordem importa)

```
[VOCÊ] Railway: 3 serviços (mongo, back, front)
            │
[VOCÊ] Envs (back: MONGODB_URI interno, CORS, NODE_ENV, chaves Stellar; front: API base)
            │
[VOCÊ] Custom domains + GoDaddy CNAMEs (stellar, api.stellar)
            │
        (propagação DNS + TLS ~minutos)
            │
[EU] Verificar cadeia verde (health, CORS, front→back→mongo)
            │
[EU+VOCÊ] Semear Mongo + ensaio do fluxo de escrow ao vivo
```

Em paralelo, sem depender do Railway, **eu já adianto**: sweep do front, bump de versão, testes, seed e runbook.

---

## Bloco A — EU faço agora (sem bloqueio)

| # | Tarefa | Entrega |
|---|---|---|
| A1 | Sweep do `nido-front` atrás de "Bounties"/"beta" + confirmar que o API base é por env (`NEXT_PUBLIC_API_URL`) | Front 100% NIDO, apontável pra `api.stellar.nido.global` |
| A2 | Bump de versão `1.0.0` → `2.0.0` (back: `package.json`, `/health`, swagger) | Marco "saindo do BETA" |
| A3 | Rodar a suíte de testes do back (`npm test`) | Prova das ~409 verdes ("impecável") |
| A4 | Revisar o seed de demo (`seed-demo-campaign` / `/api/seed`) | Cenário de demo redondo, pronto pra rodar no Mongo novo |
| A5 | Escrever o **RUNBOOK do demo ao vivo** (caminho exato de cliques) | Roteiro à prova de falha pro pitch |

## Bloco B — VOCÊ faz (infra; só você tem acesso)

| # | Tarefa |
|---|---|
| B1 | Railway: criar projeto + serviço **Mongo** (gera `MONGO_URL` interna) |
| B2 | Railway: serviço **back** — envs (`MONGODB_URI` interno, `CORS_ALLOWED_ORIGINS=https://stellar.nido.global,http://localhost:3000`, `NODE_ENV=production`, chaves Stellar/Treasury/Arbiter, `SEED_SECRET`) + domínio `api.stellar.nido.global` |
| B3 | Railway: serviço **front** — `NEXT_PUBLIC_API_URL=https://api.stellar.nido.global` + domínio `stellar.nido.global` |
| B4 | GoDaddy: 2 CNAMEs (`stellar` → front, `api.stellar` → back) |

## Bloco C — EU faço depois que B subir (verificação + dados)

| # | Tarefa |
|---|---|
| C1 | Testar `api.stellar.nido.global/health` + preflight CORS de `stellar.nido.global` |
| C2 | Validar cadeia front → back → mongo (login demo, listar campanha) |
| C3 | Semear o Mongo novo + smoke test do fluxo de escrow (create → fund → release/dispute) |

---

## Cronograma sugerido

**Hoje (08/06):**
- EU: A1, A2, A3, A4, A5 (tudo que não depende de infra).
- VOCÊ: B1, B2, B3 (subir os 3 serviços e setar envs).

**Amanhã (09/06):**
- VOCÊ: B4 (CNAMEs na GoDaddy) logo cedo (dá tempo de propagar).
- EU: C1, C2, C3 assim que os domínios responderem.
- EU+VOCÊ: ensaio do demo ao vivo seguindo o runbook (A5).

**Folga (10–11/06):** ajustes finos e ensaio do pitch com a stack já estável.

---

## Fora de escopo deste plano (não bloqueiam o demo)

- Submissão SCF Build Award (~US$ 70k) e pitch deck — trilha de materiais, paralela.
- Iniciativa "Saldo do Host + Campanha por Aceitação" — arquitetura documentada, implementação pós-Village.
- Migração da chave do Arbiter pra KMS/HSM — roadmap de hardening.
