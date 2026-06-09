# 03 — Arquitetura: Campanha Pública por Aceitação

Novo tipo de campanha onde o creator **solicita entrada**, o Host **aceita
individualmente** e **define o valor exato** dentro de uma **faixa (range)**, o creator
**opta por participar** e **submete**, e o Host **decide se paga** aquele conteúdo.

> ⚠️ **Regra central — aceite ≠ pagamento garantido.** Há **dois gates de decisão do
> Host**: (Gate 1) aceitar o creator e definir o valor apenas **reserva** o dinheiro;
> (Gate 2) **depois do submit**, o Host/empresa **avalia o conteúdo** e só então decide
> se **paga** (`APPROVED`) ou **não paga** (`DECLINED`). Um creator aceito que tem o
> conteúdo recusado **não recebe**, e o valor reservado **volta ao saldo do Host**.
> Diagramas em [`06_DIAGRAMAS.md`](06_DIAGRAMAS.md).

---

## 1. Conceito e diferença para os tipos atuais

| Tipo | Quem entra | Valor | Pagamento |
|------|-----------|-------|-----------|
| Pública padrão (hoje) | qualquer creator submete | pool dividido / reward tiers | vencedores escolhidos no fim |
| Privada / KOL (hoje) | lista de KOLs pré-definida (`list_kols`) | valor por KOL fixado na criação | seletivo (`paymentKolsSelective`) |
| **Pública por aceitação (NOVA)** | creator **solicita**, Host **aprova 1-a-1** | **range [min,max]**; valor exato definido **no aceite** | Host aprova/recusa **cada submissão** |

Exemplo: Host quer reels sobre a empresa, disposto a pagar **US$ 20–100** por reels. O
valor real de cada creator é definido na aceitação (ex.: nano-influencer US$ 25,
mid-tier US$ 80). Ao submeter, o Host valida o conteúdo e decide se libera o pagamento.

---

## 2. Máquina de estados (por creator, não por campanha)

Cada par (creator, campanha) é uma **candidatura** (`campaign_application`) com seu
próprio ciclo:

```
                  creator solicita
        ┌───────────────────────────────┐
        ▼                               │
   ┌─────────┐  host recusa      ┌──────────────┐
   │REQUESTED │ ───────────────▶ │   REJECTED   │ (fim)
   └─────────┘                   └──────────────┘
        │ host aceita + define amount∈[min,max]
        ▼
   ┌──────────┐  creator declina   ┌──────────────┐
   │ ACCEPTED │ ─────────────────▶ │ WITHDRAWN    │ (fim, libera reserva)
   │ (amount) │                    └──────────────┘
   └──────────┘
        │ creator aceita participar  → reserva amount no saldo do host
        ▼
   ┌──────────────┐
   │ PARTICIPATING │  (prazo p/ submeter; expira → EXPIRED, libera reserva)
   └──────────────┘
        │ creator submete conteúdo
        ▼
   ┌──────────────┐  host aprova  ┌──────────────┐
   │  SUBMITTED   │ ────────────▶ │   APPROVED   │ → CAMPAIGN_PAYOUT (paga amount)
   └──────────────┘               └──────────────┘
        │ host recusa
        ▼
   ┌──────────────┐
   │   DECLINED   │ → CAMPAIGN_RELEASE (devolve reserva ao host; creator não recebe)
   └──────────────┘
```

**Estados:** `REQUESTED · ACCEPTED · REJECTED · PARTICIPATING · WITHDRAWN · SUBMITTED ·
APPROVED · DECLINED · EXPIRED`.

**Quando o saldo é reservado?** Decisão D3 (ver [`05`]). Recomendação: reservar **no
aceite** (`ACCEPTED`, valor exato já conhecido) e segurar até `APPROVED` (paga) ou
`DECLINED/WITHDRAWN/EXPIRED` (libera). Alternativa: reservar o **teto** na criação da
campanha (`max * cap`) e só converter no aceite. A segunda protege melhor o creator
(garante que há fundos antes de ele trabalhar), mas trava mais capital do Host.

---

## 3. Fluxo ponta a ponta

```
HOST cria campanha (tipo=acceptance):
  - define range { min, max }, max_participants (cap), prazos, requisitos de conteúdo
  - opção: reservar teto agora (CAMPAIGN_RESERVE = max*cap) — recomendado
  - campanha vai a 'active' e fica visível publicamente

CREATOR descobre e solicita:
  - POST .../applications  → cria application REQUESTED
  - NOTIFICA o host ("novo creator solicitou entrada na campanha X")

HOST decide (inbox de solicitações):
  - aceitar: PATCH .../applications/:id/accept { amount } com min≤amount≤max
       → ACCEPTED; reserva amount; NOTIFICA creator ("aceito por US$ Y, deseja participar?")
  - recusar: PATCH .../applications/:id/reject → REJECTED; NOTIFICA creator

CREATOR aceito decide participar:
  - participar: PATCH .../applications/:id/participate → PARTICIPATING (inicia prazo)
  - declinar:   PATCH .../applications/:id/withdraw   → WITHDRAWN (libera reserva)

CREATOR submete:
  - POST .../applications/:id/submit { submission_* }  → SUBMITTED
    (reaproveita os campos de submissão já existentes em CampaignParticipants)

HOST valida o conteúdo:
  - aprovar: PATCH .../applications/:id/approve → APPROVED → paga amount ao creator
       (CAMPAIGN_PAYOUT a partir da treasury → wallet do creator) + FEE; NOTIFICA creator
  - recusar: PATCH .../applications/:id/decline { reason } → DECLINED (libera reserva)
       NOTIFICA creator
```

---

## 4. Relação com `CampaignParticipants`

Duas opções (decisão D2 em [`05`]):

- **(A) Nova collection `campaign_applications`** com a máquina de estados acima, e ao
  `APPROVED` materializa um registro em `campaign_participants` (`winner=true`,
  `amount_received=amount`) para reaproveitar relatórios/earnings existentes.
  **Recomendado** — não polui o model atual, que já é enorme e cheio de campos de
  métricas sociais.
- (B) Estender `CampaignParticipants` com `application_status` + `assigned_amount`.
  Menos collections, mas mistura "submissão" com "candidatura" e exige migração
  cuidadosa dos consumidores atuais (jobs de métricas, mindshare, payout).

---

## 5. Validações e regras de negócio

- `min ≥ ` (piso de plataforma, ex.: US$ 1) e `max ≥ min`; range coerente com fee.
- No aceite: `min ≤ amount ≤ max` (rejeitar fora do range).
- Cap de participantes: nº de `ACCEPTED+PARTICIPATING+SUBMITTED+APPROVED` ≤
  `max_participants`. Bloquear aceites acima do cap (ou exigir mais saldo).
- Saldo: só aceitar se `available` (ou a reserva-teto) cobrir o `amount`.
- Prazo de participação e prazo de submissão (expiram → `EXPIRED`, libera reserva — job).
- Idempotência por transição (uma application não volta de `APPROVED`).
- Anti-abuso: 1 application por (creator, campanha); creator precisa ter wallet da chain
  da campanha cadastrada **antes** de participar (destino do payout).

---

## 6. Modo Trustless opcional (Trilho B / Stellar) por aceitação

Para Hosts/creators que exijam garantia non-custodial, ao `ACCEPTED` em vez de reservar
saldo no ledger, criar um **micro-escrow Stellar** (`StellarService.createEscrow`) com
`jobId = applicationId`, Host=conta do Host (ou conta custodial Nido), Talent=creator,
Arbiter=Nido. `APPROVED→release`, `DECLINED/EXPIRED→refund`. Reaproveita 100% do
`StellarController`. **Fora do MVP** — listar como fase 3.

---

## 7. Notificações (reaproveita `Notification`)

| Evento | Para | Texto |
|--------|------|-------|
| `application.requested` | Host | "{creator} solicitou entrada na campanha {campanha}" |
| `application.accepted` | Creator | "Você foi aceito em {campanha} por US$ {amount}. Deseja participar?" |
| `application.rejected` | Creator | "Sua solicitação em {campanha} não foi aceita" |
| `application.submitted` | Host | "{creator} submeteu conteúdo em {campanha}" |
| `application.approved` | Creator | "Conteúdo aprovado! US$ {amount} a caminho" |
| `application.declined` | Creator | "Conteúdo não aprovado em {campanha}" |
