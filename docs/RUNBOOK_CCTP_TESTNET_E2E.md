# Runbook — CCTP V2 Inbound: e2e Testnet (Ethereum Sepolia → Stellar Testnet)

Objetivo: validar fim-a-fim o funding de escrow por CCTP **no testnet** antes de
ligar em mainnet (`CCTP_ENABLED=true`). Este run valida de uma vez os 4 pontos
em aberto: encoding do `hookData`, decimais (6dp), shape da resposta do Iris e o
endereco do `TokenMessengerV2` EVM no testnet.

Chain de origem escolhida: **Ethereum Sepolia** (domain 0). Destino: **Stellar
Testnet** (CCTP domain 27).

Criterio de "verde" (gate p/ mainnet): um escrow sai de `CREATED` →
`PENDING_INBOUND_MINT` → `FUNDED` com USDC minted na conta G do escrow, sem
intervencao manual fora do fluxo do app.

---

## Mapa do fluxo (o que o codigo faz)

```
Host (wallet EVM)            Frontend                Backend (nido-api)            Stellar Testnet
     |                          |                          |                            |
     |                          |  POST /escrow/inbound/prepare ------------------>     |
     |                          |  <-- {amount(6dp), mintRecipient, hookData, ...}      |
     | approve(USDC, TMv2) <----| burnCctpEvm()            |                            |
     | depositForBurnWithHook ->| (assina na MetaMask)     |                            |
     |  -> burnTxHash           |                          |                            |
     |                          |  POST /escrow/inbound/register {sourceTxHash} -->     |  status=PENDING_INBOUND_MINT
     |                          |  POST /escrow/inbound/relay ------------------->      |
     |                          |                          | fetchAttestation(Iris) --> |
     |                          |                          | mint_and_forward(msg,att)->| USDC mint -> escrow G
     |                          |  <-- status=FUNDED        |                            |
```

Encoding confirmado no codigo (`CctpInboundService.prepareInbound`):
- `mintRecipient` = `StrKey.decodeContract(cctpForwarder)` em bytes32 (contrato forwarder recebe o mint e repassa).
- `hookData` = `StrKey.decodeEd25519PublicKey(escrow_public_key)` cru, 32 bytes — **este e o #1 risco a validar.**
- `amount` = base-units 6dp (ex.: "1" USDC → "1000000").
- `destinationCaller` = bytes32 zero (relay permissionless).
- `maxFee` = "0", `minFinalityThreshold` = 2000 (Standard).

Endereco TokenMessengerV2 EVM testnet (front `lib/cctp/config.ts`):
`0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` — **verificar contra os docs da Circle.**

---

## Fase A — Carteira / Ethereum Sepolia

- [ ] MetaMask → Settings → Advanced → habilitar "Show test networks"
- [ ] Selecionar a rede **Sepolia** (chainId 11155111)
- [ ] Pegar **Sepolia ETH** (gas) num faucet:
      - https://cloud.google.com/application/web3/faucet/ethereum/sepolia
      - ou https://www.alchemy.com/faucets/ethereum-sepolia
- [ ] Pegar **USDC de teste** na Sepolia: https://faucet.circle.com → rede "Ethereum Sepolia"
- [ ] Conferir que o USDC recebido casa com o config do backend:
      `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
      (`cctp.config.ts` → CCTP_SOURCE_CHAINS.ethereum.usdc.testnet)

Quanto USDC: pegue >= o valor do escrow de teste (sugestao: criar escrow de **1 USDC**).

---

## Fase B — Backend em modo testnet (local)

> NAO mexer no `.env` de producao. Use um `.env` local apontando p/ testnet.
> O subsistema CCTP e inerte ate `CCTP_ENABLED=true` (gate em `cctpConfig.enabled`).

Chaves relevantes do `.env` local:

```
STELLAR_NETWORK=testnet
CCTP_ENABLED=true
# Iris: deixar vazio usa o sandbox por default (iris-api-sandbox.circle.com)
CCTP_IRIS_BASE_URL=
CCTP_IRIS_API_KEY=
# Soroban RPC: vazio usa soroban-testnet.stellar.org por default
STELLAR_SOROBAN_RPC_URL=
```

Pre-requisitos de contas no **Stellar Testnet**:
- [ ] Treasury testnet com XLM (paga a fee do `mint_and_forward`) — fund via friendbot
- [ ] Arbiter testnet configurado (multisig do escrow nativo)
- [ ] A conta do escrow precisa de **trustline USDC** (criada no setup normal do escrow)

Checagens antes do burn:
- [ ] `npm run cctp:check` — confirma os contratos Soroban testnet (forwarder
      `CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ`) e que
      `mint_and_forward` e permissionless
- [ ] `npm run dev` — sobe o backend local
- [ ] Confirmar no boot que `cctpConfig.enabled === true` e `network === 'testnet'`

Rotas expostas (gated por CCTP_ENABLED):
- `POST /api/stellar/escrow/inbound/prepare`
- `POST /api/stellar/escrow/inbound/register`
- `POST /api/stellar/escrow/inbound/relay`
- Cron: `GET|POST /api/jobs/run-pending-inbound-mints` (cronGuard) — fallback se o relay on-demand nao pegar a atestacao a tempo

---

## Fase C — Frontend apontando p/ testnet

- [ ] Front (`nido-front/bounties-front`) com `IS_MAINNET=false` (network testnet)
- [ ] API base apontando pro backend local da Fase B
- [ ] wagmi conectado na **Sepolia** (a UI faz `switchChain` se a wallet estiver em outra rede — `burn.ts`)
- [ ] Na tela do escrow: secao "fundeie de outra rede (CCTP)" → chip **Ethereum** (EVM habilitado; Solana/Sui ficam "em breve")

---

## Fase D — Execucao e2e (happy path)

1. [ ] Criar um escrow de teste (status `CREATED`) — host = sua wallet
2. [ ] Clicar em fundear via CCTP → escolher **Ethereum**
       - front chama `prepareInbound` → recebe amount/mintRecipient/hookData
3. [ ] Aprovar o gasto de USDC (MetaMask) — `approve(TMv2, amount)`
4. [ ] Assinar `depositForBurnWithHook` (MetaMask) → guarda `burnTxHash`
5. [ ] front chama `registerBurn` → escrow vai p/ `PENDING_INBOUND_MINT`
6. [ ] front chama `relayInbound` (best-effort); se a atestacao ainda nao saiu,
       o cron termina depois
7. [ ] Aguardar atestacao da Circle (Sepolia Standard finality pode levar ~13-19min;
       e por isso que mainnet vai querer L2/Fast Transfer)
8. [ ] Quando a atestacao ficar `complete`, o relay faz `mint_and_forward` e o
       escrow vira **FUNDED** (poll de status na UI a cada 15s)

Forcar o relay manual durante a espera (se quiser acelerar o teste):
```
curl -X POST http://localhost:PORT/api/stellar/escrow/inbound/relay \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"jobId":"<jobId>"}'
```
Ou disparar o cron:
```
curl -X POST http://localhost:PORT/api/jobs/run-pending-inbound-mints \
  -H "x-cron-key: <CRON_KEY>"
```

---

## Fase E — Validacoes (o gate real)

- [ ] **hookData correto**: o USDC minted chegou na conta G **do escrow** (nao ficou
      preso no forwarder). Se ficar preso/reverter → o encoding do `hookData`
      (ed25519 cru 32 bytes) esta errado — ajustar em `prepareInbound`.
- [ ] **Decimais**: o amount FUNDED bate com o burn (1 USDC = 1000000 base units).
- [ ] **Iris shape**: `fetchAttestation` leu `messages[0].status === 'complete'`
      com `message` + `attestation` (sem erro de parsing).
- [ ] **TMv2 testnet**: o `depositForBurnWithHook` na Sepolia foi aceito com o
      endereco `0x8FE6B999...2DAA` (se reverter, endereco/ABI errados).
- [ ] Escrow FUNDED mantem garantias nativas (multisig 2-de-3, timebound refund).

Se tudo verde: o e2e testnet passou. Anotar os tx hashes (burn EVM + mint Soroban).

---

## Pra onde vamos depois do verde

1. Repetir com um **L2** (Base/Arbitrum Sepolia) p/ medir latencia menor — candidato a default de demo.
2. Implementar burn helpers **Solana + Sui** (UI ja tem stubs) + preencher
       `CCTP_SOURCE_CHAINS.sui.usdc.testnet` (TODO no config).
3. **Mainnet flip**: `CCTP_ENABLED=true` no env de prod APOS o e2e verde, com o
       escrow nativo seguindo como trilho primario. Rodar `npm run cctp:check`
       em mainnet e validar o TMv2 mainnet (`0x28b5a0e9...8cf5d`) contra a Circle.
4. Decidir Standard vs Fast Transfer (threshold 1000) p/ a experiencia de funding
       em mainnet — Standard e o default seguro hoje.

---

## Gotchas conhecidos

- `config/stellar.ts` chama `dotenv.config()` no load — por isso `StellarController`
  faz lazy-load do `CctpInboundService` via `require()`. Nao transformar em import
  top-level (quebra os e2e tests que assinam JWT com secret de teste).
- Rodar testes leves: `--runInBand` / poucos workers (jest full congela a maquina).
- Sandbox do Iris pode demorar a indexar o burn → 404 e esperado por um tempo
  (`fetchAttestation` retorna null em 404, o cron tenta de novo).
</content>
</invoke>
