# 05 — Roadmap, Riscos e Decisões abertas

---

## 1. Roadmap faseado

### Fase 0 — Fundação do ledger (1 sprint)
- `WalletService` + collections `ledger_entries` / `host_wallets`.
- Testes de invariante (available/reserved ≥ 0; double-entry fecha em zero).
- Reconciliação básica treasury ↔ ledger (read-only, alerta).
- **Sem UI ainda** — só base contábil sólida (é onde mora o risco financeiro).

### Fase 1 — Depósito + Saque (1–2 sprints)
- Endpoints `deposit/intent|confirm` e `withdraw`.
- `depositWatcher` (começar pela chain mais usada; fallback manual por txHash já cobre).
- `withdrawalProcessor` + controles de segurança (2FA, whitelist, threshold de revisão).
- Front: tela **Carteira do Host** (saldo, extrato, depositar, sacar) reaproveitando
  os `*WalletModal`.

### Fase 2 — Campanha por aceitação (custodial) (2 sprints)
- `campaign_applications` + máquina de estados + reserva/payout/release no ledger.
- Endpoints Host (inbox/accept/reject/approve/decline) e Creator
  (request/participate/withdraw/submit).
- Campanha padrão passa a poder ser **paga por saldo** (debita em vez de exigir tx).
- Front: criação com range, inbox de solicitações do Host, estados no lado do creator,
  notificações.

### Fase 3 — Trustless mode opcional (Stellar) (1–2 sprints)
- Micro-escrow por aceitação reaproveitando `StellarController`.
- Opt-in por campanha; refund automático por deadline já existe.

### Fase 4 — Hardening / compliance
- Auditoria do ledger, limites, KYC/AML se aplicável, KMS para chaves da treasury
  (já no radar do SCF Build Award).

---

## 2. Riscos

| # | Risco | Severidade | Mitigação |
|---|-------|-----------|-----------|
| R1 | **Custódia/regulatório:** manter saldo de clientes por tempo indefinido pode caracterizar custódia/serviço financeiro (varia por jurisdição). | Alta | Aval jurídico antes da Fase 1. ToS claros. Trustless mode (Fase 3) como alternativa non-custodial. Limites de saldo iniciais. |
| R2 | **Erro contábil / saldo negativo / double-spend.** | Alta | Double-entry imutável + txn Mongo + invariantes testadas + reconciliação. Ledger é fonte de verdade; `host_wallets` é só cache. |
| R3 | **Saque fraudulento** (conta comprometida drena saldo). | Alta | 2FA/reauth no saque, whitelist de wallet, threshold p/ revisão manual, rate limit, alerta. |
| R4 | **Depósito não creditado / creditado em dobro.** | Média | Idempotência por txHash (índice único), watcher + fallback, status machine. |
| R5 | **Creator trabalha e Host não aprova** (disputa de confiança na acceptance). | Média | Reservar fundos no aceite (garante liquidez); regras claras; histórico/reputação; trustless mode para casos sensíveis. |
| R6 | **Capital travado** no Host se reservar o teto na criação. | Baixa | Oferecer as duas estratégias de reserva (D3); mostrar "reservado vs disponível". |
| R7 | **Multi-chain divergente** (precisão, finality, watcher por chain). | Média | Começar por 1 chain (Stellar/USDC, onde já há maturidade), expandir incremental. |
| R8 | **Regressão no fluxo atual** de pagamento por campanha. | Média | Campanha padrão continua funcionando; saldo é caminho alternativo, não substituição forçada. `campaign_type` default 'standard'. |

---

## 3. Decisões abertas (dependem do Gustavo)

> Cada decisão tem uma **recomendação**; o resto da arquitetura já está escrito para a
> recomendação, mas é trocável.

- **D1 — Custódia: ledger interno (custodial) vs conta blockchain por Host?**
  *Recomendação:* ledger interno custodial no MVP (reaproveita treasury, já é o modelo
  de fato), com trustless mode opcional depois. → adotado nos docs 02/04.

- **D2 — Acceptance: nova collection `campaign_applications` vs estender
  `CampaignParticipants`?**
  *Recomendação:* nova collection + materializar participant no `APPROVED`. → doc 03/04.

- **D3 — Quando reservar saldo na acceptance: no aceite (amount exato) vs teto na
  criação (max×cap)?**
  *Recomendação:* reservar no aceite (capital eficiente) **e** exigir que `available`
  cubra o aceite. Oferecer "reservar teto" como opção para Hosts que querem garantir
  liquidez aos creators. → doc 02/03.

- **D4 — Segurança do saque:** exigir 2FA/reauth? Só permitir wallets já cadastradas?
  Threshold de valor para revisão manual de admin? *Recomendação:* sim aos três.

- **D5 — Chains no MVP:** todas (EVM/SOL/SUI/Stellar) ou começar por uma?
  *Recomendação:* começar por **Stellar/USDC** (maturidade + watcher por memo simples),
  expandir.

- **D6 — Stablecoins por chain:** quais tokens aceitar no depósito (USDC apenas? USDT?
  BRL stablecoin, alinhado ao Solana Incubator?). Impacta `TOKENS` config e validação.

- **D7 — Modelo de fee na acceptance:** fee sobre cada payout aprovado? Sobre o teto
  reservado? *Recomendação:* fee sobre volume **liquidado** (igual hoje, 0,5% + plano),
  cobrado no `CAMPAIGN_PAYOUT`.

- **D8 — Onde colocar as rotas de wallet:** `host.routes.ts` vs novo `wallet.routes.ts`.
  *Recomendação:* novo `wallet.routes.ts` + `WalletController` (separação limpa).

---

## 4. Próximo passo sugerido

1. Gustavo revisa este folder e fecha D1–D8 (principalmente **D1 custódia** e **D5
   chains**, que definem o escopo da Fase 0/1).
2. Validação jurídica de R1 em paralelo.
3. Detalhar tickets da Fase 0 (ledger) — é o alicerce; nada de UI antes do ledger estar
   coberto por testes.
