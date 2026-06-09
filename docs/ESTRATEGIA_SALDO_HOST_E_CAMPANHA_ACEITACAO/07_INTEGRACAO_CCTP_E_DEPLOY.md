# 07 — Integração com o agente CCTP e com o deploy `stellar.nido.global`

Conecta a estratégia de **Saldo do Host + Campanha por Aceitação** (docs 00–06) com
duas peças que já existem no projeto:

1. o **agente CCTP inbound** (`CctpInboundService`) — funding cross-chain de USDC nativo;
2. a **stack de deploy do Stellar Village** no Railway sob `stellar.nido.global`
   (`docs/DECISAO_DEPLOY_STELLAR_RAILWAY.md`).

---

## Parte A — CCTP é o trilho de DEPÓSITO cross-chain do Saldo do Host

### A.1 O que o agente CCTP faz hoje

`CctpInboundService` (gated por `CCTP_ENABLED`, hoje inerte) financia um **escrow** com
USDC **nativo** queimado em outra chain, em 3 passos + cron:

```
prepareInbound(jobId, sourceChain)   → devolve params do burn (mintRecipient=forwarder,
                                        hookData=conta G do escrow, amount em base units)
   ↓ host assina o burn na própria wallet (backend nunca toca chave de origem)
registerBurn(jobId, sourceTxHash)    → escrow vai a PENDING_INBOUND_MINT (attestation PENDING)
   ↓ Circle Iris ateste o burn
relayMint(jobId) / runPendingInboundMints (cron)
   → fetchAttestation(Iris) → submitMintAndForward() no CctpForwarder Soroban
   → escrow FUNDED (mint_and_forward é permissionless; treasury paga a taxa)
```

Domínio Stellar = 27. Chains de origem suportadas: Ethereum, Arbitrum, Base, Polygon,
Solana, Sui. `mint_and_forward(message, attestation)` não tem `caller` → relay sem
assinatura extra do usuário. USDC nativo ponta a ponta (sem bridge/wrapped).

### A.2 A sacada: o depósito do Saldo do Host é o MESMO fluxo, com outro destino

O doc 02 (§3) propõe o depósito do Host como: *Host envia stablecoin → treasury → job
credita o ledger*. Isso é **estruturalmente idêntico** ao CCTP inbound — muda só o
**destino do mint** e o **efeito final**:

| Aspecto | CCTP hoje (escrow) | CCTP para Saldo do Host (novo) |
|---|---|---|
| `hookData` (destino do forward) | conta G do **escrow** do job | conta G de **depósito do Host** (ou treasury + memo=hostId) |
| Estado intermediário | `PENDING_INBOUND_MINT` no escrow | `PENDING_INBOUND_MINT` no `wallet_deposits` |
| Efeito ao concluir | escrow → `FUNDED` | `WalletService.credit` → lançamento `DEPOSIT` (+available) |
| Quem dispara o relay | `runPendingInboundMints` (cron) | **mesmo cron**, ramo de depósito |
| Assinatura | host assina o burn; relay sem auth | igual |

**Consequência prática:** o **watcher de depósito** que o doc 04 pediu
(`depositWatcher`) **já existe 80% pronto** como `runPendingInboundMints`. O depósito
multi-chain (decisões D5/D6) não precisa ser construído do zero — é uma generalização
do `relayOne`: em vez de só virar escrow `FUNDED`, ele credita o ledger do Host.

### A.3 Desenho da integração

Diagrama renderizado da rail ponta a ponta:
[`diagramas/05_rail_cctp_ponta_a_ponta.png`](diagramas/05_rail_cctp_ponta_a_ponta.png)
(ver [`06_DIAGRAMAS.md`](06_DIAGRAMAS.md) §5).

![Rail ponta a ponta CCTP](diagramas/05_rail_cctp_ponta_a_ponta.png)


```
  Host (USDC nativo em ETH/ARB/BASE/POLY/SOL/SUI)
        │  burn assinado pela wallet do Host (non-custodial na origem)
        ▼
  Circle CCTP V2  ──Iris attestation──►  Nido relay (treasury paga taxa)
        │                                      │ submitMintAndForward()
        ▼                                      ▼
  CctpForwarder Soroban (domínio 27)  ──mint+forward──►  conta de depósito do Host
        │                                                      │
        └──────────────────────────────────────────────►  WalletService.credit()
                                                               → ledger: DEPOSIT (+available)
                                                               → saldo disponível p/ campanha ou saque
```

A partir daí, **gastar em campanha por aceitação é 100% interno** (ledger
reserve/payout/release — docs 02/03): o CCTP aparece **só na fronteira do depósito**.
Nenhum funding on-chain por creator. Isso mantém a campanha por aceitação barata e
instantânea enquanto houver saldo.

### A.4 O que muda no código (incremental, sem regressão)

- **Generalizar `hookData`/destino:** hoje fixo na conta do escrow
  (`prepareInbound`). Adicionar modo "depósito de saldo" cujo `hookData` aponta para a
  conta de depósito do Host (ou treasury com mapeamento por `memo`/registro
  `wallet_deposits`).
- **Generalizar `relayOne`:** ao concluir o mint, ramificar — se o alvo é escrow →
  `FUNDED` (como hoje); se é depósito de saldo → `WalletService.credit` + marcar
  `wallet_deposits` CONFIRMED. O estado `PENDING_INBOUND_MINT` já modela o "aguardando
  atestação".
- **Reusar o cron** `runPendingInboundMints` para ambos (escrow e depósito).
- **Fallback nativo Stellar** (sem CCTP) continua válido para depósito direto em USDC
  Stellar (treasury + memo), como no doc 02 §3 4b.
- **Modo trustless da acceptance (doc 03 §6):** se um dia o micro-escrow por creator
  for CCTP-funded, é o caminho original do `CctpInboundService` sem alteração.

> Resultado: CCTP deixa de ser só "funding de escrow" e vira o **rail de entrada de
> liquidez** da Nido (escrow **e** saldo do Host), reaproveitando atestação Iris +
> forwarder Soroban + relay permissionless já implementados.

---

## Parte B — Como isso pousa na stack `stellar.nido.global` (Railway)

Referência: `docs/DECISAO_DEPLOY_STELLAR_RAILWAY.md` (aprovado, 2026-06-08).

### B.1 Topologia (recap) e onde a feature mora

```
GoDaddy DNS (nido.global)
  ├─ CNAME stellar      → Railway FRONT (Next.js)   = stellar.nido.global
  └─ CNAME api.stellar  → Railway BACK  (nido-api)  = api.stellar.nido.global
                              │ MONGODB_URI interno (rede privada railway.internal)
                              └─ Railway MONGO (sem domínio público), DB = bounties
```

- **Back (`api.stellar.nido.global`):** recebe TODAS as rotas novas
  (`/api/host/wallet/*`, `/api/host/applications/*`, `/api/creator/.../applications`).
  É o mesmo serviço — não há microserviço novo.
- **Front (`stellar.nido.global`):** telas de Carteira do Host, inbox de solicitações,
  criação de campanha por aceitação. `NEXT_PUBLIC_API_URL=https://api.stellar.nido.global`.
- **Mongo (privado):** novas collections (`ledger_entries`, `host_wallets`,
  `wallet_deposits`, `withdrawal_requests`, `campaign_applications`) vivem no **mesmo DB
  `bounties`** — **não** renomear o DB (quebra dados, vide "NÃO mexer" do deploy doc).

### B.2 Crons/jobs no serviço back do Railway

O `JobService` já roda crons no back (`runExpiredEscrows`, `runPendingInboundMints`).
A feature adiciona ao **mesmo loop**:
- `depositWatcher` → na prática é o `runPendingInboundMints` generalizado (CCTP) +
  varredura de depósitos nativos Stellar.
- `withdrawalProcessor` → fila de saques (assina payout da treasury).
- `applicationExpirer` → expira candidaturas e libera reserva.
- `ledgerReconciler` → treasury on-chain vs Σ ledger.

⚠️ **Concorrência:** se o back escalar para >1 réplica no Railway, os crons precisam de
lock distribuído. **Já existe `JobLock`** (model) — usar nele para os novos jobs, senão
risco de double-relay / double-payout.

### B.3 Variáveis de ambiente novas/relevantes (Railway → serviço back)

| Env | Para quê | Observação |
|---|---|---|
| `CCTP_ENABLED` | liga o depósito cross-chain | hoje `false` (inerte). Ligar só quando o fluxo de depósito estiver pronto |
| `CCTP_IRIS_BASE_URL` / `CCTP_IRIS_API_KEY` | atestação Circle | necessário p/ relay |
| `CCTP_CONTRACTS_BY_NET` (forwarder) | `mint_and_forward` | forwarder Soroban domínio 27 |
| `CCTP_SOURCE_CHAINS` | chains de origem habilitadas | alinhar com D5/D6 (quais stablecoins/chains no MVP) |
| `CORS_ALLOWED_ORIGINS` | já no deploy doc | deve conter `https://stellar.nido.global` |
| Treasury/Arbiter keys | já presentes (escrow) | **também assinam saque e relay** — custódia. Migrar p/ KMS/HSM é o item do SCF Build Award |

### B.4 Segurança/custódia no contexto do deploy

- O **saque** e o **relay CCTP** usam a **chave da treasury** já no env do Railway. Com
  o Saldo do Host, a treasury passa a guardar saldo de cliente de forma contínua →
  reforça o risco **R1/R3** (docs 05) e a urgência do **KMS/HSM** (SCF). Para o Village,
  manter limites baixos e, se possível, saque com revisão manual (`adminGuard`).
- `/api-docs` deve seguir 404 em prod (já é o comportamento). Headers nota A mantidos.
- Rate limit: as rotas novas devem usar `paymentLimiter`/limiter dedicado (saque e
  accept/approve são sensíveis).

### B.5 Demo no Village (stellar.nido.global)

Para mostrar a feature ao vivo no demo-day:
1. **Seed** (`/api/seed`, `SEED_SECRET`): criar 1 Host com **saldo pré-creditado**, 1
   campanha **por aceitação** com range, e alguns creators solicitando entrada — para
   demonstrar Gate 1 (aceitar + valor) e Gate 2 (aprovar/recusar) sem esperar on-chain.
2. **CCTP opcional:** se `CCTP_ENABLED=true` + Iris + forwarder + treasury com saldo de
   taxa, dá para demonstrar **depósito real cross-chain** virando saldo. Senão, usar o
   depósito nativo Stellar (mais simples) ou saldo semeado.
3. **Narrativa de pitch:** "USDC nativo de qualquer chain (CCTP) → vira saldo do Host na
   Nido → campanha por aceitação com aprovação de conteúdo → payout ao creator", tudo
   sobre `stellar.nido.global`. Conecta o diferencial Stellar (escrow trustless) + CCTP
   (multichain) + o novo modelo de saldo/aceitação num só fluxo.

---

## Parte C — Mapa de dependências (resumo)

```
DEPLOY stellar.nido.global (Railway)
  └─ back api.stellar.nido.global = nido-api  (mesmo serviço)
        ├─ rotas novas /wallet/* e /applications/*        (docs 02/03/04)
        ├─ JobService crons (+ JobLock se multi-réplica)  (doc 04 §5)
        │     └─ depositWatcher  ⇐⇐  CCTP runPendingInboundMints generalizado
        ├─ WalletService (ledger custodial)               (doc 02/04)
        │     └─ credit() ⇐ ponto de entrada do depósito CCTP/nativo
        └─ Mongo (DB `bounties`, privado) — novas collections

AGENTE CCTP (CctpInboundService, CCTP_ENABLED)
  ├─ hoje: funding de ESCROW cross-chain
  └─ novo: funding do SALDO DO HOST cross-chain (mesmo relay, hookData/efeito diferentes)
        └─ habilita D5/D6 (multi-chain deposit) quase de graça
```

**Decisões abertas que esta integração adiciona** (estender doc 05):
- **D9 — Ligar CCTP no MVP do saldo** ou começar só com depósito nativo Stellar?
  *Rec.:* nativo Stellar primeiro (mais simples), CCTP logo em seguida reusando o relay.
- **D10 — Destino do mint para depósito:** conta de depósito por Host vs treasury única
  + `memo`/registro `wallet_deposits`. *Rec.:* treasury + registro (menos contas
  on-chain), igual à filosofia custodial do ledger.
- **D11 — Demo do Village usa CCTP real ou saldo semeado?** *Rec.:* semeado garante a
  demo; CCTP real como "bonus" se o tempo permitir.
