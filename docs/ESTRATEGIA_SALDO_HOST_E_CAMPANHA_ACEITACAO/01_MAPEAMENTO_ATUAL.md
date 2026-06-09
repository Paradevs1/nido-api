# 01 — Mapeamento do estado atual

Base para entender onde a nova funcionalidade se encaixa. Tudo abaixo foi extraído do
código em `nido-api` (branch `feat/stellar-integration`) e `nido-front`.

---

## 1. Backend (`nido-api`)

**Stack:** Node 20 / TypeScript / Express / MongoDB (driver nativo, sem Mongoose ODM —
cada model é uma classe estática com métodos `getCollection()`). Auth JWT + guards
(`authenticatedUserGuard`, `hostGuard`, `adminGuard`, `optionalAuthGuard`). Rate limit
por usuário.

### 1.1 Models relevantes (`src/models/`)

| Model | Collection | Papel | Relevância p/ feature |
|-------|-----------|-------|------------------------|
| `User` | `users` | Host/Creator/Admin. Campos `wallet_evm/sol/sui/stellar`, `plan_id`, `total_earnings`. | **Vamos anexar saldo do Host aqui ou em collection própria.** Já tem as wallets do usuário (destino do saque). |
| `Campaign` | `campaigns` | Campanha. `total_prize_pool`, `reward_tiers[]`, `list_kols[]`, `payment_chain/token`, `status`, `payment_received`, `rewards_distributed`, `isPrivate`, `is_cac`. | **Vamos adicionar `campaign_type` e `value_range`.** |
| `CampaignParticipants` | `campaign_participants` | Submissão do creator numa campanha. `amount_received`, `winner`, `date_submit`, métricas sociais, `submissions_*`. | Base do "submit". **Acceptance precisa de estados antes do submit** (solicitação/aceite). |
| `PaymentHost` | `payment_hosts` | Registro do pagamento do Host **por campanha**. `hostId`, `campaignId`, `signature` (tx hash), `amount`, `status: pending\|confirmed\|error`. | **Modelo do "depósito".** Hoje é 1:1 com campanha; vamos generalizar para depósito de saldo. |
| `PaymentRefund` | — | Refund de excedente ao Host. | Reaproveitável para saque. |
| `Payment` / `PaymentWinnersLog` | — | Log de payouts aos vencedores. | Reaproveitável para liquidação por aceitação. |
| `StellarEscrow` | `stellar_escrows` | Escrow trustless L1 (multisig 2-de-3). Lifecycle `CREATED→FUNDED→{COMPLETED,REFUNDED,DISPUTED}`. | Trilho opcional "trustless mode" da nova feature. |
| `Notification` | `notifications` | Notificações in-app. | **Usado para avisar Host de nova solicitação e creator do aceite.** |
| `Plan` / `PlanPayment` | — | SaaS BASIC/CORE/ENTERPRISE. | Define fee % do Host (afeta cálculo de custo da campanha). |

### 1.2 Os DOIS trilhos de pagamento (ponto crítico)

A Nido tem **dois mecanismos de pagamento coexistindo**:

**Trilho A — Custodial via Treasury (`PaymentService`) — é o mainstream em produção:**
- `paymentHostCreate(wallet, campaignId, hostId, chain, symbol)` → calcula
  `expectedAmount = base + fee`, cria `PaymentHost` `pending`, retorna
  `destinationAddress = getDestinationWallet(chain)` (**wallet da Nido**) + token.
- Host envia a stablecoin on-chain para a wallet da Nido.
- `paymentHostConfirm(paymentId, taxId, ...)` → `validateTransactionOnChain()` confere o
  tx hash → marca campanha `active`, `payment_received=true`.
- Distribuição: `sendTokenWinners(campaignId)` e `paymentKolsSelective(campaignId,
  selectedKols[])` → **a Nido paga os creators a partir da sua própria wallet/treasury**.
- **Implicação:** a Nido **já custodia** o dinheiro da campanha entre o pagamento do Host
  e o payout dos creators. O "saldo do Host" é a mesma custódia, só desacoplada da
  campanha.

**Trilho B — Escrow Stellar trustless (`StellarService` / `StellarController`):**
- `POST /api/stellar/escrow/create` → treasury patrocina reservas e cria conta escrow
  multisig 2-de-3 (Host+Talent+Arbiter). Host **assina** o funding no Freighter
  (non-custodial — USDC sai da wallet do Host).
- `fund → release | refund | dispute`. Refund automático por `TimeBounds`/deadline
  (`runExpiredEscrows`).
- **Implicação:** aqui a Nido NÃO custodia — é confiança mínima. É o diferencial de
  marketing, mas é mais pesado (1 conta on-chain + multisig por job).

> **Decisão de arquitetura derivada:** o saldo do Host nasce no **Trilho A**
> (custodial, simples, já validado em prod). O **Trilho B** vira um "modo trustless"
> opcional por cima — não bloqueia o MVP. Ver [`05`](05_ROADMAP_RISCOS_DECISOES.md).

### 1.3 Rotas existentes que tocam o fluxo

```
# Host / campanha
POST   /api/host/campaigns                         cria campanha
PUT    /api/host/campaigns/:id                      edita
POST   /api/host/campaigns/:id/create-campaign-winners
GET    /api/host/campaigns/:id/get-users-campaign-winners

# Pagamento (custodial)
POST   /api/payment/payment-host-create             gera depósito por campanha
POST   /api/payment/payment-host-confirm            confirma tx on-chain
POST   /api/payment/send-winners/:campaign_id       paga vencedores
POST   /api/payment/send-payment-kols-selective/:campaign_id  paga KOLs selecionados
GET    /api/payment/{solana,evm,sui,stellar}/balance  (adminGuard) saldo treasury

# Creator
POST   /api/creator/submit-campaign/:campaign_id    submissão
POST   /api/creator/insert-wallets                  cadastra wallets do creator

# Escrow Stellar (trilho B)
POST   /api/stellar/escrow/create | fund | release | refund
POST   /api/stellar/dispute | dispute/claim
```

### 1.4 Cálculo de custo de campanha (hoje)

`calculateExpectedAmountWithFee(campaign, hostId)`:
- `baseAmount = is_cac ? list_kols.length * limit_amount_convertion : total_prize_pool`
- `feePercent = getHostFeePercent(hostId, baseAmount)` (depende do plano)
- retorna `baseAmount + feeAmount`

Mínimo de `total_prize_pool` hoje: **US$ 50** (em `HostService.createCampaign`).

---

## 2. Frontend (`nido-front/bounties-front`)

Next.js (App Router) + Vitest. Estrutura relevante:

```
src/app/host/
  campaign/{create,manage,[id]}      criação e gestão de campanha
  create/                            onboarding host
  plans/  profile/  communities/
src/components/
  host/{campaigns,create,plans,profile}  HostPaymentGuard.tsx
  wallet/{Evm,Solana,Stellar,Sui}WalletModal.tsx   conexão de wallet por chain
  campaigns/  creator/  notifications/  stellar/
src/lib/
  api/        cliente HTTP
  wallet/     hooks de wallet por chain
  stellar/    integração escrow
  cctp/       funding cross-chain
```

**Componentes que serão estendidos/criados:**
- `wallet/*WalletModal.tsx` — já fazem conexão por chain → reaproveitar para
  **depósito** e **saque** (origem/destino).
- `host/HostPaymentGuard.tsx` — guarda de pagamento → vira guarda de **saldo
  suficiente**.
- Novo: tela de **Carteira do Host** (saldo, extrato, depositar, sacar).
- Novo: criação de campanha tipo **aceitação** (campo de range).
- Novo: **inbox de solicitações** do Host (aceitar + definir valor) e estado
  "aguardando aceite / aprovado" no lado do creator.

---

## 3. Gaps para a nova feature (o que NÃO existe hoje)

1. **Saldo persistente por Host** — `PaymentHost` é por-campanha; não há "carteira"
   com saldo acumulado, extrato, ou conceito de "disponível vs reservado".
2. **Saque (withdraw)** — não há fluxo de devolução de saldo livre para a wallet do
   Host (só refund de excedente de campanha).
3. **Detecção automática de depósito** — hoje o confirm é disparado pelo front com o
   tx hash; não há watcher que credita saldo ao detectar depósito.
4. **Tipo de campanha por aceitação** — `Campaign` só tem `isPrivate` (lista de KOLs
   pré-definida). Não há "público + aprovação individual + valor por creator definido
   no aceite".
5. **Range de valor** — `total_prize_pool` é fixo; não há `[min, max]`.
6. **Máquina de estados de candidatura** — `CampaignParticipants` começa no submit;
   não há `REQUESTED→ACCEPTED→PARTICIPATING→SUBMITTED→APPROVED/DECLINED`.
7. **Reserva de saldo** — não há lock de fundos por candidatura aceita.
