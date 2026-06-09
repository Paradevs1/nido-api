# 02 — Arquitetura: Saldo / Carteira do Host

Objetivo: o Host **deposita saldo X** em stablecoin (na chain correspondente) numa
wallet da Nido vinculada a ele, podendo **sacar** de volta para a wallet própria ou
**gastar** pagando campanhas. Substitui o "pagamento por campanha" como rail primário,
mantendo-o como caso particular ("pagar campanha = debitar saldo").

---

## 1. Princípio: ledger interno custodial, lastreado pela treasury

A Nido **já** recebe os fundos das campanhas na treasury por chain
(`getDestinationWallet(chain)`) e já paga creators a partir dela. Vamos formalizar isso
num **ledger interno double-entry**:

```
            DEPÓSITO on-chain                       SAQUE on-chain
 Wallet Host ───USDC──▶ Treasury Nido      Treasury Nido ───USDC──▶ Wallet Host
       │                     │                    │                     │
       ▼                     ▼                    ▼                     ▼
   (watcher detecta)   +saldo no ledger     -saldo no ledger      (payout assinado
                       (available)          (available)            pela treasury)
```

**Por que ledger interno e não 1 conta blockchain por Host no MVP:**
- Reaproveita 100% da infra de treasury + validação on-chain já em produção.
- Evita custo/complexidade de criar e patrocinar reservas de 1 conta por Host em cada
  chain (EVM/SOL/SUI/Stellar).
- Saldo agregado por chain na treasury; atribuição por Host é contábil (DB).
- **Upgrade futuro:** quem exigir non-custodial usa "trustless mode" (escrow Stellar),
  sem reescrever o ledger.

> ⚠️ Implicação de custódia/regulatório: a Nido passa a manter saldo de clientes de
> forma explícita e por tempo indefinido (hoje já o faz, porém transitoriamente por
> campanha). Ver risco R1 em [`05`](05_ROADMAP_RISCOS_DECISOES.md).

---

## 2. Modelo de saldo: disponível × reservado

Cada Host tem, **por chain+token**, três números derivados do ledger:

| Campo | Significado |
|-------|-------------|
| `available` | saldo livre — pode sacar ou alocar em campanha |
| `reserved` | comprometido com campanhas ativas (não pode sacar) |
| `total = available + reserved` | depositado e ainda não pago/sacado |

Toda operação é uma **transação de ledger** (entrada imutável), e os saldos são a soma
das entradas (ou um snapshot materializado + recomputável). Nunca editar saldo "na
mão" — sempre via lançamento.

### Tipos de lançamento (`ledger_entries`)

| `type` | available | reserved | Gatilho |
|--------|-----------|----------|---------|
| `DEPOSIT` | +X | 0 | watcher confirma depósito on-chain |
| `WITHDRAWAL_HOLD` | −X | 0 | Host solicita saque (lock otimista) |
| `WITHDRAWAL_SETTLED` | 0 | 0 | payout on-chain confirmado (consome o hold) |
| `WITHDRAWAL_REVERTED` | +X | 0 | payout falhou → devolve ao disponível |
| `CAMPAIGN_RESERVE` | −X | +X | campanha por aceitação criada (reserva o teto) |
| `CAMPAIGN_PAYOUT` | 0 | −X | creator aprovado → paga (sai do reserved) |
| `CAMPAIGN_RELEASE` | +X | −X | recusa/sobra → devolve reserva ao disponível |
| `FEE` | −X | 0 ou −X | fee da Nido sobre volume liquidado |

Invariante: `available ≥ 0` e `reserved ≥ 0` sempre. Toda mutação roda numa transação
Mongo (`session.withTransaction`) com checagem de saldo **antes** de gravar.

---

## 3. Fluxo de DEPÓSITO

```
1. Host abre "Carteira" no front, escolhe chain + valor, conecta wallet.
2. POST /api/host/wallet/deposit/intent { chain, token, amount }
   → cria DepositIntent (status PENDING), retorna { depositId, destinationAddress, token, memo? }
3. Host envia stablecoin on-chain para destinationAddress (treasury).
4a. (preferido) Watcher on-chain detecta a transferência → confirma → lança DEPOSIT.
4b. (fallback, igual hoje) front chama
    POST /api/host/wallet/deposit/confirm { depositId, txHash }
    → validateTransactionOnChain(txHash, chain, amount, token) → lança DEPOSIT.
5. Saldo available += amount. Notifica Host.
```

- **Idempotência:** `txHash` é único no ledger (índice único). Reprocessar o mesmo hash
  não credita duas vezes.
- **Stellar:** `destinationAddress` = treasury Stellar; pode usar `memo` = depositId
  para casar depósito↔Host sem watcher dedicado.
- **EVM/SOL/SUI:** validação por `txHash` (já existe `validateTransactionOnChain`).
- Reaproveita `PaymentHost` evoluído OU nova collection `wallet_deposits` (preferir
  nova, para não sobrecarregar a semântica por-campanha — ver [`04`](04_API_E_DATA_MODEL.md)).

---

## 4. Fluxo de SAQUE (withdraw)

```
1. Host pede saque: POST /api/host/wallet/withdraw { chain, token, amount, destinationWallet }
   - destinationWallet default = user.wallet_<chain>; validar formato por chain.
2. Backend: checa available ≥ amount → lança WITHDRAWAL_HOLD (−available).
   Cria WithdrawalRequest status PENDING.
3. Liquidação (assíncrona, fila): a Nido assina payout da treasury → wallet do Host.
   - on-chain OK   → WITHDRAWAL_SETTLED (consome hold) → status SETTLED.
   - on-chain falha → WITHDRAWAL_REVERTED (+available) → status FAILED.
4. Notifica Host com txHash.
```

**Controles de segurança do saque (críticos — é dinheiro saindo):**
- `hostGuard` + reautenticação/2FA para saque (decisão D4 em [`05`]).
- Whitelisting da `destinationWallet` ou só permitir as wallets já cadastradas no User.
- Limite/threshold para revisão manual (`adminGuard`) acima de um valor.
- Idempotência por `withdrawalId`; nunca assinar payout duas vezes (índice único +
  status machine).
- Rate limit dedicado (já há `paymentLimiter`).

---

## 5. Fluxo de GASTO em campanha (substitui pagamento por campanha)

Campanha **padrão** (fixa, como hoje) e campanha **por aceitação** (range) ambas passam
a debitar do saldo:

```
Campanha padrão:
  criar campanha (custo = base+fee)
    → se available ≥ custo: CAMPAIGN_RESERVE (move p/ reserved) → campanha 'active'
    → senão: bloqueia e oferece "depositar mais X"
  payout vencedores → CAMPAIGN_PAYOUT por vencedor; sobra → CAMPAIGN_RELEASE

Campanha por aceitação (ver doc 03):
  criar campanha com range [min,max] e cap de participantes
    → reserva o TETO = max * max_participants (ou um teto explícito) → CAMPAIGN_RESERVE
  a cada creator aprovado → CAMPAIGN_PAYOUT(valor exato)
  ao encerrar / recusar → CAMPAIGN_RELEASE da reserva não usada
```

**Vantagem:** o Host não faz transferência on-chain por campanha — UX muito melhor,
campanhas instantâneas enquanto houver saldo. O fee da Nido continua sendo cobrado
(lançamento `FEE`), preservando o modelo de receita (0,5% + planos).

---

## 6. Reconciliação treasury ↔ ledger

Job periódico (estende `JobService`) que compara, por chain:
`saldo on-chain da treasury` vs `Σ total de todos os Hosts + buffer operacional`.
Alerta se divergir além de tolerância. Essencial para auditoria e confiança.

---

## 7. Componentes de código a criar/alterar (backend)

| Item | Ação |
|------|------|
| `models/HostWallet.ts` (ou saldo derivado) | NOVO — snapshot de saldo por host+chain+token |
| `models/LedgerEntry.ts` | NOVO — lançamentos imutáveis (double-entry) |
| `models/WalletDeposit.ts` | NOVO — intents/confirmações de depósito |
| `models/WithdrawalRequest.ts` | NOVO — pedidos de saque |
| `services/WalletService.ts` | NOVO — credit/debit/reserve/release atômicos + invariantes |
| `services/PaymentService.ts` | ALTERAR — `paymentHostConfirm` passa a poder creditar saldo; criar campanha debita saldo |
| `controllers/HostController.ts` ou novo `WalletController.ts` | NOVO endpoints de wallet |
| `routes/host.routes.ts` (ou `wallet.routes.ts`) | NOVO — rotas `/wallet/*` |
| `services/JobService.ts` | ALTERAR — watcher de depósito, fila de saque, reconciliação |
| `models/Notification.ts` | reaproveitar — eventos de depósito/saque |

Detalhe de schema e endpoints em [`04_API_E_DATA_MODEL.md`](04_API_E_DATA_MODEL.md).
