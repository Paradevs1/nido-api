# PaymentController

## Descrição

Controller de **pagamentos**: envio de tokens para vencedores de campanha, saldos em EVM/SOL/SUI, criação e confirmação de pagamento de host (campanha) e de plano (assinatura), e envio de pagamento para KOLs selecionados.

## Base path

`/api/payments`

## Autenticação

Todas as rotas exigem **authGuard** (usuário autenticado). Operações sensíveis (envio de tokens, confirmação) devem ser restritas a host/admin conforme regra de negócio.

## Serviço

- **PaymentService** (`src/services/PaymentService.ts`)

## Endpoints

| Método | Path | Handler | Descrição |
|--------|------|---------|-----------|
| GET | `/evm/balance` | getBalanceEVM | Saldo da carteira EVM (da aplicação) |
| GET | `/solana/balance` | getBalanceSOL | Saldo da carteira Solana |
| GET | `/sui/balance` | getBalanceSUI | Saldo da carteira SUI |
| POST | `/send-winners/:campaign_id` | sendTokenWinners | Enviar tokens para vencedores da campanha |
| POST | `/send-payment-kols-selective/:campaign_id` | paymentKolsSelective | Enviar pagamento para KOLs selecionados |
| POST | `/payment-host-create` | paymentHostCreate | Criar pagamento de host (campanha) |
| POST | `/payment-host-confirm` | paymentHostConfirm | Confirmar pagamento de host |
| POST | `/plan-create` | paymentPlanCreate | Criar pagamento de plano (assinatura) |
| POST | `/plan-confirm` | paymentPlanConfirm | Confirmar pagamento de plano |

## Observações

- Saldos retornam valores das carteiras configuradas (ex.: treasury).
- Fluxo típico: create → usuário/host realiza transação on-chain → confirm (webhook ou callback) para atualizar status.
