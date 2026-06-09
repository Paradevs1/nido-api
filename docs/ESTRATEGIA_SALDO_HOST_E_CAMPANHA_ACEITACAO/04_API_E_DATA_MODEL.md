# 04 — API e Data Model (especificação consolidada)

Schemas no estilo dos models atuais (classe estática + `getCollection()`, driver
MongoDB nativo). Valores monetários em **string decimal** (evitar float — alinhado a
`StellarEscrow.amount: string`); montar helper de aritmética decimal.

---

## 1. Novos campos em models existentes

### `Campaign` (`src/models/Campaign.ts`)
```ts
campaign_type?: 'standard' | 'acceptance';   // default 'standard' (retrocompat)
value_range?: { min: number; max: number };  // só p/ acceptance
funded_from_balance?: boolean;               // true = debitou saldo do host
reserved_amount?: number;                    // teto reservado (acceptance)
```
- Campanhas antigas sem `campaign_type` ⇒ tratadas como `standard`.

### `User` (`src/models/User.ts`)
- Não armazenar saldo aqui (fonte de verdade = ledger). Opcional: cache
  `wallet_balance_cache?: Record<chain, {available,reserved}>` só para leitura rápida,
  sempre recomputável.

---

## 2. Novas collections

### `ledger_entries` — lançamentos imutáveis (double-entry)
```ts
interface ILedgerEntry {
  _id: ObjectId;
  hostId: string;
  chain: string;            // 'stellar' | 'evm' | 'solana' | 'sui' ...
  token: string;            // 'USDC' ...
  type: 'DEPOSIT' | 'WITHDRAWAL_HOLD' | 'WITHDRAWAL_SETTLED' | 'WITHDRAWAL_REVERTED'
      | 'CAMPAIGN_RESERVE' | 'CAMPAIGN_PAYOUT' | 'CAMPAIGN_RELEASE' | 'FEE';
  delta_available: number;  // pode ser negativo
  delta_reserved: number;
  ref_type: 'deposit' | 'withdrawal' | 'campaign' | 'application' | 'fee';
  ref_id: string;           // depositId / withdrawalId / campaignId / applicationId
  balance_after?: { available: number; reserved: number }; // snapshot opcional
  created_at: Date;
}
// Índices: { hostId, chain, token, created_at }, { ref_type, ref_id }
//          { 'meta.txHash': 1 } unique sparse (idempotência de depósito/saque)
```

### `host_wallets` — snapshot materializado (derivável do ledger)
```ts
interface IHostWallet {
  _id: ObjectId;
  hostId: string; chain: string; token: string;
  available: number; reserved: number;   // sempre ≥ 0
  updated_at: Date;
}
// Índice único { hostId, chain, token }. Mutado SÓ via WalletService dentro de txn.
```

### `wallet_deposits`
```ts
interface IWalletDeposit {
  _id: ObjectId;
  hostId: string; chain: string; token: string;
  amount: number;
  destinationAddress: string;     // treasury
  memo?: string;                  // = depositId (Stellar)
  txHash?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';
  created_at: Date; updated_at: Date;
}
// Índice único sparse { txHash }
```

### `withdrawal_requests`
```ts
interface IWithdrawalRequest {
  _id: ObjectId;
  hostId: string; chain: string; token: string;
  amount: number;
  destinationWallet: string;
  status: 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'NEEDS_REVIEW';
  txHash?: string; failure_reason?: string;
  created_at: Date; updated_at: Date;
}
```

### `campaign_applications` (campanha por aceitação)
```ts
interface ICampaignApplication {
  _id: ObjectId;
  campaignId: string;
  creatorId: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'PARTICIPATING' | 'WITHDRAWN'
        | 'SUBMITTED' | 'APPROVED' | 'DECLINED' | 'EXPIRED';
  amount?: number;                // definido no aceite (∈ range)
  reserve_ledger_id?: string;     // lançamento da reserva
  participate_deadline?: Date;
  submit_deadline?: Date;
  // submissão (reaproveita os campos de CampaignParticipants)
  submission_twitter?: string; submission_tiktok?: string;
  submission_instagram?: string; submission_youtube?: string;
  decline_reason?: string;
  participantId?: string;         // ref ao CampaignParticipants criado no APPROVED
  created_at: Date; updated_at: Date;
}
// Índice único { campaignId, creatorId }; { campaignId, status }
```

---

## 3. Endpoints REST

### Carteira do Host — `routes/wallet.routes.ts` (ou em `host.routes.ts`), `hostGuard`
```
GET    /api/host/wallet                          saldo por chain/token (available/reserved/total)
GET    /api/host/wallet/ledger?chain&page        extrato (lançamentos)

POST   /api/host/wallet/deposit/intent           { chain, token, amount } → { depositId, destinationAddress, token, memo? }
POST   /api/host/wallet/deposit/confirm          { depositId, txHash } (fallback manual)
# (watcher confirma automaticamente quando possível)

POST   /api/host/wallet/withdraw                 { chain, token, amount, destinationWallet? } (2FA/reauth)
GET    /api/host/wallet/withdrawals?status&page
```

### Campanha por aceitação
```
# Host
POST   /api/host/campaigns                        (estendido) aceita campaign_type='acceptance' + value_range
GET    /api/host/campaigns/:id/applications?status inbox de solicitações
PATCH  /api/host/applications/:id/accept          { amount }  (min≤amount≤max)
PATCH  /api/host/applications/:id/reject
PATCH  /api/host/applications/:id/approve         (paga) 
PATCH  /api/host/applications/:id/decline         { reason }

# Creator
GET    /api/creator/campaigns?type=acceptance     descobrir campanhas por aceitação
POST   /api/creator/campaigns/:id/applications    solicitar entrada → REQUESTED
GET    /api/creator/applications?status            minhas candidaturas
PATCH  /api/creator/applications/:id/participate   ACCEPTED → PARTICIPATING
PATCH  /api/creator/applications/:id/withdraw      desistir
POST   /api/creator/applications/:id/submit        { submission_* } → SUBMITTED
```

---

## 4. `WalletService` — contrato dos métodos atômicos

Todos rodam dentro de `session.withTransaction` (Mongo), validam invariantes **antes**
de gravar, e gravam `ledger_entries` + atualizam `host_wallets` no mesmo commit.

```ts
class WalletService {
  getBalance(hostId, chain, token): Promise<{available,reserved,total}>
  credit(hostId, chain, token, amount, ref): Promise<void>          // DEPOSIT
  holdWithdrawal(hostId, chain, token, amount, ref): Promise<void>  // checa available≥amount
  settleWithdrawal(withdrawalId, txHash): Promise<void>
  revertWithdrawal(withdrawalId, reason): Promise<void>
  reserve(hostId, chain, token, amount, ref): Promise<void>         // available→reserved
  payout(hostId, chain, token, amount, ref): Promise<void>          // reserved→creator (+FEE)
  release(hostId, chain, token, amount, ref): Promise<void>         // reserved→available
}
```

Regra de ouro: **nenhum** outro service grava em `host_wallets`/`ledger_entries` direto.

---

## 5. Jobs (estender `JobService` / `runExpiredEscrows` como referência)

| Job | Função |
|-----|--------|
| `depositWatcher` | varre transferências on-chain p/ a treasury por chain → confirma `wallet_deposits` → `credit` |
| `withdrawalProcessor` | processa fila `withdrawal_requests PENDING` → assina payout → settle/revert |
| `applicationExpirer` | `PARTICIPATING` sem submit no prazo / `ACCEPTED` sem participar → `EXPIRED` + `release` |
| `ledgerReconciler` | compara treasury on-chain vs Σ saldos do ledger → alerta divergência |

---

## 6. Aritmética monetária

- Guardar como string decimal ou inteiro em unidades mínimas (ex.: 6 casas USDC).
- Helper `decimal.ts` (add/sub/cmp) — **nunca** `Number` para somar saldo.
- Validar `amount > 0`, dentro de limites de plataforma, e precisão por token.
