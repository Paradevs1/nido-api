# Runbook — Demo ao Vivo (Stellar Village / Pitch)

> Objetivo: rodar o ciclo de escrow trustless NIDO ao vivo, sem travar, reforçando o posicionamento:
> **a melhor estrutura do mundo — confiança e segurança — para qualquer projeto crescer com pagamentos em stablecoins globais e marketing de influência totalmente gestionado.**
> Stack: `stellar.nido.global` (front) + `api.stellar.nido.global` (back) + Mongo privado (Railway).

---

## ⚠️ Decisão pendente (definir ANTES do demo): mainnet ou testnet?

| Opção | Prós | Contras |
|---|---|---|
| **Testnet** (recomendado p/ o demo AO VIVO) | Zero risco de fundos reais; repetível; sem custo | É testnet — não use a palavra na narrativa |
| **Mainnet** | Bate com a prova (§3.1 do doc de investidor) | Move USDC real ao vivo; risco operacional no palco |

**Recomendação:** rodar o demo ao vivo em **testnet** e **apontar a prova de mainnet gravada** (5 escrows reais, 50 USDC, hashes no StellarExpert) como evidência. Define `STELLAR_NETWORK` no Railway de acordo. A narrativa fala de "USDC on-chain", sem destacar a rede.

---

## T-30min — Checklist pré-demo

- [ ] `api.stellar.nido.global/health` responde `OK` (eu verifico)
- [ ] CORS libera `stellar.nido.global` (eu verifico)
- [ ] Seed rodado: `railway run npx ts-node scripts/seed-demo-campaign.ts` → campanha "NIDO — Campanha Demo · Escrow Stellar" visível no front
- [ ] Wallet **Host** (Freighter) conectada, com a campanha aberta
- [ ] Endereço **Talent** à mão (carteira de recebimento)
- [ ] **Treasury** com XLM suficiente (patrocínio de reserves + FeeBump) — `npm run stellar:check`
- [ ] **Arbiter** configurado (chave do árbitro disponível no backend)
- [ ] Aba do StellarExpert aberta com um dos 5 escrows reais de mainnet (plano B / prova)
- [ ] Internet de backup (hotspot do celular)

---

## Roteiro principal — Happy path (Host paga, Talent recebe)

Cada passo tem a **ação** (o que clicar) e a **fala** (o que dizer — ancorada no posicionamento).

**1. Abrir a campanha demo**
- Ação: front → campanha "NIDO — Campanha Demo · Escrow Stellar".
- Fala: "Uma marca lança uma campanha e quer garantir o pagamento ao creator antes do trabalho começar. Aqui não tem 'confie em mim' — tem garantia on-chain."

**2. Criar o escrow** (`POST /api/stellar/escrow/create`)
- Ação: criar o escrow (host wallet, talent wallet, valor, prazo).
- Fala: "A NIDO cria um cofre multisig 2-de-3 — marca, creator e árbitro. A NIDO **nunca** é dona do dinheiro. E o cofre nasce com **zero XLM**: a Treasury patrocina as reserves."

**3. Financiar** (`GET .../funding-xdr` → Freighter assina → `POST .../fund`)
- Ação: clicar em financiar; **assinar no Freighter**; confirmar.
- Fala: "A marca só assina. A taxa de rede? A NIDO paga via FeeBump. O usuário **nunca toca XLM nem gas**. É experiência de SaaS Web2, com liquidação on-chain por baixo." → status **FUNDED**.

**4. Liberar ao creator** (`GET .../payment-xdr` → Freighter assina → `POST .../release`)
- Ação: aprovar entrega; **assinar no Freighter**; confirmar.
- Fala: "Entrega aprovada. O backend fecha o threshold 2-de-3 com a assinatura do árbitro, envelopa em FeeBump e submete. O creator recebe USDC em **menos de 5 segundos**, auditável on-chain." → status **COMPLETED**.

**5. Fechar** (accountMerge automático)
- Fala: "Ao fechar, o `accountMerge` devolve as reserves patrocinadas pra Treasury. Custo por escrow: **menos de US$ 0,01**. Isso escala pra qualquer ticket, em qualquer lugar do mundo."

---

## Roteiro de disputa (se houver tempo / em perguntas)

`POST /api/stellar/dispute` → admin `GET /api/stellar/admin/disputes` → `POST /api/stellar/admin/resolve {winner}` → parte vencedora `GET .../dispute-xdr` → assina → `POST /api/stellar/dispute/claim`.

- Fala: "Se há divergência, abre-se disputa. Um árbitro neutro resolve. Repare: nem a NIDO, nem a marca, nem o creator movem o dinheiro sozinhos — sempre 2-de-3. Confiança vira **regra de protocolo**, não promessa."

---

## Plano B — se algo falhar ao vivo

1. **Não entre em pânico nem fique tentando.** Corte pra prova gravada.
2. Abra o **StellarExpert** com os 5 escrows reais de mainnet (50 USDC, 4 liberados + 1 reembolsado via disputa).
- Fala: "Isso aqui não é mockup — são escrows reais em mainnet, com hash auditável. O que tentei mostrar ao vivo, já rodou de verdade com USDC real."
3. Fluxos e hashes estão em `docs/NIDO_INVESTOR_TECH_DOC.md §3.1`.

---

## Mensagens-chave (repetir 2–3x ao longo do demo)

- **Non-custodial:** a NIDO nunca detém os fundos — multisig 2-de-3.
- **Zero atrito cripto:** sem gas, sem XLM, UX de Web2 — qualquer projeto do mundo adota.
- **Liquidação global em stablecoin:** USDC, ~5s, < US$ 0,01, auditável on-chain.
- **Marketing de influência gestionado de ponta a ponta:** da campanha ao pagamento garantido.
- **Não somos MVP:** produto em produção (500+ usuários, marcas reais) + prova em mainnet. Estamos **saindo do beta**, não buscando mercado.
