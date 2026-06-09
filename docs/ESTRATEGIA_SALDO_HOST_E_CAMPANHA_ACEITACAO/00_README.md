# Estratégia — Saldo do Host + Campanha Pública por Aceitação

> Pasta estratégica para a próxima evolução da Nido: dar ao Host uma **wallet/saldo
> pré-financiado dentro da plataforma** (depósito, saque, gasto) e um **novo tipo de
> campanha — "pública por aceitação"** com faixa de valor (range) e aprovação
> creator-a-creator.

Data: 2026-06-08 · Repos: `nido-api` (`feat/stellar-integration`), `nido-front` (`feat/stellar-integration`)

---

## Índice

| Doc | Conteúdo |
|-----|----------|
| [`01_MAPEAMENTO_ATUAL.md`](01_MAPEAMENTO_ATUAL.md) | Mapa do que já existe: backend (models, services, rotas), frontend, e os dois trilhos de pagamento atuais (custodial-treasury vs escrow Stellar). |
| [`02_ARQUITETURA_SALDO_HOST.md`](02_ARQUITETURA_SALDO_HOST.md) | Wallet/saldo do Host: depósito on-chain, ledger interno, saque, gasto em campanha. Máquina de estados e modelo de dados. |
| [`03_ARQUITETURA_CAMPANHA_ACEITACAO.md`](03_ARQUITETURA_CAMPANHA_ACEITACAO.md) | Novo tipo de campanha por aceitação: range de valor, fluxo solicitação→aceite→valor→participação→submit→aprovação/recusa. |
| [`04_API_E_DATA_MODEL.md`](04_API_E_DATA_MODEL.md) | Especificação consolidada: novas collections, campos novos em models existentes, endpoints REST, notificações. |
| [`05_ROADMAP_RISCOS_DECISOES.md`](05_ROADMAP_RISCOS_DECISOES.md) | Faseamento, riscos (custódia/regulatório/concorrência), e **decisões abertas que dependem do Gustavo**. |
| [`06_DIAGRAMAS.md`](06_DIAGRAMAS.md) | Diagramas (renderizados em imagem) da lógica. Destaque para a regra **aceite ≠ pagamento**: os dois gates de decisão do Host. |
| [`07_INTEGRACAO_CCTP_E_DEPLOY.md`](07_INTEGRACAO_CCTP_E_DEPLOY.md) | Como a estratégia se conecta ao **agente CCTP** (que vira o rail de depósito cross-chain do saldo) e à stack de deploy **`stellar.nido.global`** no Railway. |

---

## TL;DR estratégico

**O que muda no produto**

1. **Hoje:** o Host paga **por campanha** — valor fechado (ex.: US$ 300), enviado de
   uma vez para a Nido, que assegura, distribui aos vencedores e faz refund do
   excedente. Tudo amarrado àquela campanha.

2. **Proposta — Saldo do Host:** o Host **deposita um saldo X** em stablecoin (na
   chain correspondente) numa wallet da Nido vinculada a ele. Desse saldo ele pode:
   - **Sacar** de volta para a wallet própria dele a qualquer momento (saldo livre);
   - **Investir/gastar** pagando campanhas que ele criar — sem precisar de uma
     transferência on-chain a cada campanha.

3. **Proposta — Campanha por Aceitação:** novo tipo de campanha **pública por
   aceitação** com **faixa de valor** (ex.: reels de US$ 20 a US$ 100). O fluxo:
   - Creator vê a campanha e **solicita entrada**;
   - Host recebe **notificação** e **decide** se aceita aquele creator;
   - Ao aceitar, o Host **define o valor exato** (dentro do range) daquele creator;
   - Creator aceito **opta por participar** e **submete** o conteúdo;
   - Host/empresa **decide se aquele conteúdo será pago** (libera) **ou não** (recusa).

**A descoberta arquitetural que destrava tudo:** a Nido **já opera de forma
custodial** no trilho principal de pagamento (`PaymentService`): o Host paga para a
wallet de destino da Nido (treasury), e a Nido paga os creators. Portanto, "saldo do
Host" **não introduz uma nova custódia** — é a generalização do que já acontece, só
que desacoplando o depósito da campanha individual e materializando um **ledger por
Host**. Isso reduz drasticamente o risco de implementação.

**Recomendação de arquitetura (resumo):**
- **Saldo = ledger interno (double-entry) em MongoDB**, lastreado pelos depósitos
  on-chain que já caem na treasury por chain. Não criar uma conta blockchain por Host
  no MVP — reaproveitar a treasury existente + um watcher de depósito.
- **Campanha por aceitação = nova máquina de estados por creator** (collection
  `campaign_applications`), com **reserva de saldo** no momento do aceite e
  **liquidação** (pagamento ao creator a partir da treasury) no momento da aprovação.
- **Escrow Stellar trustless** permanece como **upgrade opcional** ("Trustless mode")
  por cima do saldo, para Hosts/creators que exigem garantia non-custodial — sem virar
  pré-requisito do MVP.

Ver decisões abertas em [`05_ROADMAP_RISCOS_DECISOES.md`](05_ROADMAP_RISCOS_DECISOES.md).
