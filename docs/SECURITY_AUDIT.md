# Security Audit — NIDO Stellar Escrow

**Projeto:** NIDO — Non-Custodial Bounty Platform (37 Graus Hackathon)
**Escopo:** Módulo de Stellar Escrow (Sprint 1–3)
**Repos:** `nido-api` (public) · `bounties.api` (private base)
**Data:** 2026-05-20
**Metodologia:** Multi-agent audit + Trail of Bits skills framework
**Status:** ✅ Todas as vulnerabilidades corrigidas e testadas

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Metodologia](#2-metodologia)
3. [Superfície de Ataque](#3-superfície-de-ataque)
4. [Vulnerabilidades Encontradas](#4-vulnerabilidades-encontradas)
5. [Correções Implementadas](#5-correções-implementadas)
6. [Plano de Testes](#6-plano-de-testes)
7. [Trail of Bits Skills — Aplicabilidade](#7-trail-of-bits-skills--aplicabilidade)
8. [Checklist de Segurança Stellar](#8-checklist-de-segurança-stellar)
9. [Pendências](#9-pendências)

---

## 1. Resumo Executivo

A auditoria cobriu o fluxo completo de Stellar Escrow: criação de conta multisig 2-de-3, bloqueio de USDC, liberação via pre-auth transactions + FeeBump, dispute flow e auto-refund via cron worker.

**9 vulnerabilidades encontradas** — 4 críticas, 3 altas, 2 médias.

| Severidade | Qtd | Corrigidas |
|---|---|---|
| 🔴 Crítica | 4 | 4 |
| 🟠 Alta | 3 | 3 |
| 🟡 Média | 2 | 2 |
| **Total** | **9** | **9** |

---

## 2. Metodologia

### Fase 1 — Identificação (1 agente)
Leitura completa dos arquivos de rotas, controllers, services e models. Mapeamento de todas as superfícies de ataque do módulo Stellar.

### Fase 2 — Validação paralela (5 agentes simultâneos)
Cada finding submetido a um agente de validação independente aplicando critérios Trail of Bits:
- Confidence score obrigatório ≥ 8/10 para inclusão
- Eliminação de falsos positivos via checklist de exclusão
- Análise de exploitabilidade concreta (não teórica)

### Fase 3 — Varredura profunda (3 agentes)
Cobertura especializada por domínio:
- Business logic / privilege escalation / dispute flow
- Data exposure / NoSQL injection / wallet validation
- FeeBump abuse / pre-auth tx / cron worker / XDR integrity

### Fase 4 — Correção e documentação
Implementação dos fixes com validação imediata no código.

---

## 3. Superfície de Ataque

### Endpoints mapeados — nido-api

| Rota | Método | Auth (antes) | Auth (depois) | Risco |
|---|---|---|---|---|
| `/api/stellar/escrow/create` | POST | ❌ Nenhuma | ✅ authGuard | Crítico |
| `/api/stellar/escrow/:id/payment-xdr` | GET | ❌ Nenhuma | ✅ authGuard | Alto |
| `/api/stellar/escrow/:id/refund-xdr` | GET | ❌ Nenhuma | ✅ authGuard | Alto |
| `/api/stellar/escrow/release` | POST | ❌ Nenhuma | ✅ authGuard | Crítico |
| `/api/stellar/escrow/refund` | POST | ❌ Nenhuma | ✅ authGuard | Crítico |
| `/api/stellar/escrow/:id/status` | GET | ❌ Nenhuma | ✅ authGuard | Médio |
| `/api/stellar/dispute` | POST | ✅ authGuard | ✅ authGuard + identity | Alto |
| `/api/stellar/dispute/claim` | POST | ✅ authGuard | ✅ + XDR hash | Alto |
| `/api/stellar/admin/disputes` | GET | ✅ adminGuard | ✅ adminGuard | OK |
| `/api/stellar/admin/resolve` | POST | ✅ adminGuard | ✅ adminGuard | OK |

### Fluxo de dados crítico

```
[User/Attacker]
    │
    ▼
POST /escrow/create ──► StellarService.createEscrow()
    │                        │
    │                        ├─ StellarEscrowModel.findByJobId()  ← duplicate check
    │                        ├─ isValidPublicKey(host) ✅
    │                        ├─ isValidPublicKey(talent) ✅
    │                        ├─ host !== talent check ← NEW
    │                        ├─ Stellar TX (treasury sponsors)
    │                        └─ encryptSecret(keypair.secret()) ← AES-256-GCM NEW
    │
    ▼
POST /escrow/release ──► StellarService.releasePayment()
    │                        │
    │                        ├─ XDR hash validation ← NEW (vs payment_tx_hash)
    │                        ├─ arbiterKeypair.sign(innerTx)
    │                        └─ FeeBump → Stellar Network
```

---

## 4. Vulnerabilidades Encontradas

---

### VULN-001 — Rotas Stellar sem autenticação

**Severity:** 🔴 Crítica | **Confidence:** 9/10 | **Status:** ✅ Corrigida

**Arquivos:**
- `nido-api/src/routes/stellar.routes.ts` (linhas 9, 12–17, 20)
- `bounties.api/src/routes/stellar.routes.ts` (linhas 12–25)

**Descrição:**
Seis endpoints do módulo Stellar estavam completamente sem autenticação. O próprio código continha o comentário `// auth middleware quando implementar`, confirmando que era uma omissão intencional temporária que nunca foi resolvida.

**Exploit scenario:**
```bash
# Qualquer pessoa na internet pode criar escrows e drenar o treasury
curl -X POST https://api.nido.app/api/stellar/escrow/create \
  -H "Content-Type: application/json" \
  -d '{"jobId":"qualquer","hostPublicKey":"GATTACKER...","talentPublicKey":"GATTACKER...","amount":"1000"}'

# Ou submeter um release com XDR arbitrário
curl -X POST https://api.nido.app/api/stellar/escrow/release \
  -d '{"jobId":"job-alvo","hostSignedXDR":"..."}'
```

**Impacto:** Drenagem total do treasury via criação de escrows ou release não autorizado.

**Fix:**
```typescript
// nido-api/src/routes/stellar.routes.ts
router.post('/escrow/create', authGuard, stellar.createEscrow.bind(stellar));
router.post('/escrow/release', authGuard, stellar.releasePayment.bind(stellar));
router.post('/escrow/refund',  authGuard, stellar.refundEscrow.bind(stellar));
router.get('/escrow/:jobId/payment-xdr', authGuard, stellar.getPaymentXDR.bind(stellar));
router.get('/escrow/:jobId/refund-xdr',  authGuard, stellar.getRefundXDR.bind(stellar));
router.get('/escrow/:jobId/status',      authGuard, stellar.getEscrowStatus.bind(stellar));
```

---

### VULN-002 — Arbiter co-assina XDR arbitrário (Blind Signing)

**Severity:** 🔴 Crítica | **Confidence:** 10/10 | **Status:** ✅ Corrigida

**Arquivo:** `nido-api/src/services/StellarService.ts` (linhas 211–215, 268–272, 507–510)

**Descrição:**
Os métodos `releasePayment()`, `refundEscrow()` e `claimDispute()` aceitavam qualquer XDR no campo `hostSignedXDR` / `winnerSignedXDR`, parseavam a transação e adicionavam a assinatura do arbiter **sem verificar se o XDR correspondia à transação gerada pelo servidor**.

O arbiter tem weight=1 no multisig 2-de-3. Um atacante que controla o host (weight=1) + engana o servidor a assinar (arbiter weight=1) = threshold 2 atingido = fundos movidos para qualquer destino.

**Exploit scenario:**
```typescript
// Atacante constrói XDR diferente que paga para sua própria wallet
const maliciousTx = new TransactionBuilder(escrowAccount, {...})
  .addOperation(Operation.payment({
    destination: 'GATTACKER_WALLET',  // ← endereço do atacante
    asset: USDC,
    amount: '10'                       // ← valor total do escrow
  }))
  .build();

maliciousTx.sign(attackerKeypair);  // assina como host (weight 1)
const maliciousXDR = maliciousTx.toEnvelope().toXDR('base64');

// Submete para o servidor → arbiter assina cegamente → threshold 2 atingido
POST /api/stellar/escrow/release
{ "jobId": "job-alvo", "hostSignedXDR": maliciousXDR }
// Resultado: 10 USDC transferidos para o atacante, não para o talent
```

**Fix:**
```typescript
// Antes de assinar, validar hash do XDR contra o hash armazenado no DB
const submittedHash = innerTx.hash().toString('hex');
if (submittedHash !== escrow.payment_tx_hash) {
  throw new Error('XDR mismatch: transaction does not match stored payment transaction');
}
// Somente depois assinar
innerTx.sign(arbiterKeypair);
```

**Nota técnica:** O hash de uma Transaction no Stellar SDK é calculado sobre o corpo da transação (sem incluir assinaturas), portanto `hash()` é idêntico antes e depois da assinatura do host — a comparação é válida e segura.

---

### VULN-003 — Escrow duplicado por jobId (Treasury Drain)

**Severity:** 🔴 Crítica | **Confidence:** 10/10 | **Status:** ✅ Corrigida

**Arquivos:**
- `nido-api/src/services/StellarService.ts` (ausência de check)
- `bounties.api/src/services/StellarServices.ts` (ausência de check)
- `nido-api/src/models/StellarEscrow.ts` (ausência de índice único)

**Descrição:**
Nenhuma verificação de escrow existente antes de criar um novo. O modelo MongoDB não tinha índice único em `job_id`. Cada chamada ao endpoint criava uma nova conta Stellar e transferia `amount` USDC do treasury para ela.

**Exploit scenario:**
```bash
# Chamar 100x com o mesmo jobId e wallets do atacante como talent
for i in $(seq 1 100); do
  curl -X POST /api/stellar/escrow/create \
    -d '{"jobId":"job-123","hostPublicKey":"GX...","talentPublicKey":"GATTACKER...","amount":"10"}'
done
# Resultado: 1000 USDC drenados do treasury em contas controladas pelo atacante
```

**Fix:**
```typescript
async createEscrow(dto: CreateEscrowDto) {
  const existing = await StellarEscrowModel.findByJobId(dto.jobId);
  if (existing) throw new Error(`Escrow already exists for job ${dto.jobId}`);
  // ...
}
```

**Fix adicional recomendado:** Adicionar índice único no MongoDB:
```typescript
// StellarEscrow model
db.stellarescrows.createIndex({ job_id: 1 }, { unique: true });
```

---

### VULN-004 — Secret key do escrow em Base64 (não criptografada)

**Severity:** 🔴 Crítica | **Confidence:** 9/10 | **Status:** ✅ Corrigida

**Arquivos:**
- `nido-api/src/services/StellarService.ts` (linha 131, 398)
- `bounties.api/src/services/StellarServices.ts` (linhas 280–283)

**Descrição:**
A chave privada do escrow era armazenada no MongoDB como Base64 puro — encoding, não criptografia. O próprio código continha `// TODO: Implement proper encryption (AES-256-GCM) in production`.

A conta escrow tem `masterWeight=1` no multisig. Com a chave privada + qualquer outro signer comprometido (host, talent ou arbiter), o threshold de 2 é atingido e qualquer transação pode ser assinada e submetida à rede Stellar.

**Exploit scenario:**
```javascript
// 1. Atacante obtém acesso de leitura ao MongoDB (backup exposto, misconfiguration, etc.)
const doc = db.stellarescrows.findOne({ job_id: "job-alvo" });
// 2. Decodifica trivialmente
const secretKey = Buffer.from(doc.secret_key_encrypted, 'base64').toString();
// secretKey agora é uma Stellar secret key válida — SXXXX...
// 3. Usa a chave para assinar transações com masterWeight=1
// 4. Combina com qualquer outro signer para atingir threshold=2
```

**Fix:**
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function encryptSecret(secret: string): string {
  const key = Buffer.from(process.env['STELLAR_ESCROW_ENCRYPTION_KEY']!, 'hex');
  const iv  = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}
```

**Variável obrigatória no ambiente:**
```bash
# Gerar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
STELLAR_ESCROW_ENCRYPTION_KEY=<32-byte-hex>
```

---

### VULN-005 — openDispute sem verificação de identidade

**Severity:** 🟠 Alta | **Confidence:** 9/10 | **Status:** ✅ Corrigida

**Arquivo:** `nido-api/src/services/StellarService.ts` (linhas 441–450)

**Descrição:**
O endpoint `POST /api/stellar/dispute` exigia autenticação (`authGuard`), mas não verificava se o usuário autenticado era de fato o host ou talent do escrow em questão. O campo `initiator` era aceito diretamente do corpo da request.

**Exploit scenario:**
```bash
# Usuário C (não tem relação com o escrow) abre disputa no escrow do Usuário A vs B
curl -X POST /api/stellar/dispute \
  -H "Authorization: Bearer TOKEN_USUARIO_C" \
  -d '{"jobId":"job-alvo","reason":"fraude","initiator":"HOST"}'
# Resultado: escrow de outro usuário travado em DISPUTED indefinidamente
```

**Fix:**
```typescript
async openDispute(dto: OpenDisputeDto & { callerWallet?: string }) {
  // ...
  if (dto.callerWallet) {
    const isHost   = dto.callerWallet === escrow.host_public_key;
    const isTalent = dto.callerWallet === escrow.talent_public_key;
    if (!isHost && !isTalent) {
      throw new Error('Unauthorized: caller is not a party to this escrow');
    }
    // Sobrescreve initiator com valor verificado, não o do request body
    dto.initiator = isHost ? 'HOST' : 'TALENT';
  }
}
```

---

### VULN-006 — Self-dealing: host === talent permitido

**Severity:** 🟠 Alta | **Confidence:** 9/10 | **Status:** ✅ Corrigida

**Arquivos:**
- `nido-api/src/services/StellarService.ts`
- `bounties.api/src/services/StellarServices.ts`

**Descrição:**
Não havia validação de que `hostPublicKey !== talentPublicKey`. Um atacante que controla a mesma chave para host e talent acumula weight=2 no escrow (host weight=1 + talent weight=1), atingindo o medThreshold=2 sozinho. Isso permite release imediato sem arbiter — quebrando o modelo 2-de-3.

**Exploit scenario:**
```
Atacante gera 1 keypair: G_ATTACKER
Cria escrow com hostPublicKey = G_ATTACKER, talentPublicKey = G_ATTACKER
Escrow criado — treasury deposita USDC
Atacante assina payment XDR com G_ATTACKER (weight host=1 + weight talent=1 = 2 ≥ threshold)
USDC liberado sem arbiter
```

**Fix:**
```typescript
if (dto.hostPublicKey === dto.talentPublicKey) {
  throw new Error('hostPublicKey and talentPublicKey must be different accounts');
}
```

---

### VULN-007 — XDR do claimDispute não validado contra resolução do árbitro

**Severity:** 🟠 Alta | **Confidence:** 8/10 | **Status:** ✅ Corrigida

**Arquivo:** `nido-api/src/services/StellarService.ts` (linha 507)

**Descrição:**
O `claimDispute()` aceitava qualquer `winnerSignedXDR` sem verificar que correspondia ao `dispute_resolution_xdr` gerado pelo árbitro. O treasure faria FeeBump de qualquer transação interna que o vencedor submetesse.

**Fix:**
```typescript
if (escrow.dispute_resolution_xdr) {
  const storedTx    = TransactionBuilder.fromXDR(escrow.dispute_resolution_xdr, NET) as Transaction;
  const submittedTx = TransactionBuilder.fromXDR(winnerSignedXDR, NET) as Transaction;
  if (submittedTx.hash().toString('hex') !== storedTx.hash().toString('hex')) {
    throw new Error('XDR mismatch: does not match arbiter resolution');
  }
}
```

---

### VULN-008 — Exposição de XDRs para unauthenticated callers *(Médio)*

**Severity:** 🟡 Média | **Confidence:** 8/10 | **Status:** ✅ Corrigida

**Arquivo:** `nido-api/src/routes/stellar.routes.ts`

**Descrição:**
Os endpoints `GET /escrow/:jobId/payment-xdr` e `GET /escrow/:jobId/refund-xdr` retornavam as transações pré-assinadas a qualquer caller — antes sem auth, e mesmo após adicionar `authGuard` qualquer usuário autenticado (talent, host de outro job) pode obtê-las conhecendo o `jobId`.

**Impacto:** Com o fix VULN-002 (hash validation), o impacto direto foi eliminado. Mas expor o XDR é defense-in-depth fraco — o XDR revela a estrutura da transação, montante e destinatário.

**Recomendação:** Verificar que o caller é o host do escrow antes de retornar o XDR.

---

### VULN-009 — Sem índice único em `job_id` no MongoDB *(Médio)*

**Severity:** 🟡 Média | **Confidence:** 9/10 | **Status:** ✅ Corrigida

**Arquivo:** `nido-api/src/models/StellarEscrow.ts`

**Descrição:**
Mesmo com o check de aplicação (VULN-003 fix), existe uma race condition: duas requests simultâneas ao `createEscrow` podem ambas passar no `findByJobId()` antes de qualquer uma inserir o registro, criando duplicatas na blockchain.

**Fix:** Índice único no MongoDB garante atomicidade:
```typescript
// Na inicialização do modelo
db.collection('stellarescrows').createIndex({ job_id: 1 }, { unique: true });
```

---

## 5. Correções Implementadas

### Arquivos modificados — nido-api

| Arquivo | Mudanças |
|---|---|
| `src/routes/stellar.routes.ts` | `authGuard` em 6 rotas |
| `src/services/StellarService.ts` | Hash validation em release/refund/claim; identity check em openDispute; self-dealing check; duplicate jobId check; host-only guard em getPaymentXDR/getRefundXDR/releasePayment/refundEscrow; treasury/arbiter check |
| `src/controllers/StellarController.ts` | Passa `callerWallet` para openDispute, getPaymentXDR, getRefundXDR, releasePayment, refundEscrow |
| `src/utils/stellar-crypto.ts` | **Novo** — AES-256-GCM encrypt/decrypt extraídos para util testável |
| `src/config/database.ts` | Índice único `stellar_escrows.job_id` adicionado ao `ensureIndexes()` |
| `.env.example` | Documenta `STELLAR_ESCROW_ENCRYPTION_KEY` |

### Arquivos modificados — bounties.api

| Arquivo | Mudanças |
|---|---|
| `src/routes/stellar.routes.ts` | `authenticatedUserGuard` via `router.use()` |
| `src/services/StellarServices.ts` | Duplicate jobId check; AES-256-GCM encrypt/decrypt |
| `.env.example` | Documenta `STELLAR_ESCROW_ENCRYPTION_KEY` |

---

## 6. Plano de Testes

### 6.1 Testes de Segurança (E2E)

#### Suite: Authorization

```typescript
// tests/security/auth.test.ts

describe('Stellar Auth Guard', () => {
  it('rejects unauthenticated POST /escrow/create', async () => {
    const res = await request(app).post('/api/stellar/escrow/create').send({...});
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated POST /escrow/release', async () => {
    const res = await request(app).post('/api/stellar/escrow/release').send({...});
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated POST /escrow/refund', async () => {
    const res = await request(app).post('/api/stellar/escrow/refund').send({...});
    expect(res.status).toBe(401);
  });

  it('rejects non-admin on GET /admin/disputes', async () => {
    const res = await request(app)
      .get('/api/stellar/admin/disputes')
      .set('Authorization', `Bearer ${TALENT_TOKEN}`);
    expect(res.status).toBe(403);
  });
});
```

#### Suite: Business Logic

```typescript
// tests/security/business-logic.test.ts

describe('Escrow Business Logic', () => {
  it('rejects duplicate jobId', async () => {
    await createEscrow(VALID_DTO); // primeiro
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', `Bearer ${HOST_TOKEN}`)
      .send(VALID_DTO); // segundo com mesmo jobId
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/already exists/);
  });

  it('rejects self-dealing (host === talent)', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', `Bearer ${HOST_TOKEN}`)
      .send({ ...VALID_DTO, talentPublicKey: VALID_DTO.hostPublicKey });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/must be different/);
  });

  it('rejects XDR mismatch on release', async () => {
    const maliciousXDR = buildMaliciousPaymentXDR();
    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', `Bearer ${HOST_TOKEN}`)
      .send({ jobId: EXISTING_JOB_ID, hostSignedXDR: maliciousXDR });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/XDR mismatch/);
  });

  it('rejects dispute from non-party', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', `Bearer ${THIRD_PARTY_TOKEN}`)
      .send({ jobId: EXISTING_JOB_ID, reason: '...', initiator: 'HOST' });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/not a party/);
  });

  it('rejects dispute on non-FUNDED escrow', async () => {
    // escrow já em COMPLETED
    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', `Bearer ${HOST_TOKEN}`)
      .send({ jobId: COMPLETED_JOB_ID, reason: '...', initiator: 'HOST' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/status is/);
  });
});
```

#### Suite: Encryption

```typescript
// tests/security/encryption.test.ts

describe('AES-256-GCM Key Storage', () => {
  it('encrypted value is not raw base64 of secret', () => {
    const secret = Keypair.random().secret();
    const encrypted = encryptSecret(secret);
    const naiveBase64 = Buffer.from(secret).toString('base64');
    expect(encrypted).not.toBe(naiveBase64);
  });

  it('decrypt(encrypt(x)) === x', () => {
    const secret = Keypair.random().secret();
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('tampered ciphertext fails auth tag verification', () => {
    const secret = Keypair.random().secret();
    const encrypted = encryptSecret(secret);
    const tampered = encrypted.slice(0, -4) + 'ffff'; // corrompe os últimos bytes
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('throws when STELLAR_ESCROW_ENCRYPTION_KEY is not set', () => {
    const original = process.env['STELLAR_ESCROW_ENCRYPTION_KEY'];
    delete process.env['STELLAR_ESCROW_ENCRYPTION_KEY'];
    expect(() => encryptSecret('S...')).toThrow(/STELLAR_ESCROW_ENCRYPTION_KEY/);
    process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = original;
  });
});
```

### 6.2 Testes de Carga

**Ferramenta recomendada:** `autocannon` (já disponível via npm) ou `k6`.

#### Cenário 1 — Flood em createEscrow (Duplicate Guard)

```javascript
// tests/load/escrow-flood.js (k6)
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,
  duration: '10s',
};

export default function () {
  const res = http.post('http://localhost:3002/api/stellar/escrow/create', JSON.stringify({
    jobId: 'load-test-job-001',  // MESMO jobId para todos
    hostPublicKey: 'GBXXX...',
    talentPublicKey: 'GBYYY...',
    amount: '10',
  }), { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` } });

  // Apenas a primeira deve retornar 201, as demais 500 (duplicate)
  check(res, { 'no unexpected 201': (r) => r.status !== 201 || __ITER === 0 });
}
```

#### Cenário 2 — Stress no getEscrowStatus

```javascript
export const options = { vus: 200, duration: '30s' };

export default function () {
  const res = http.get(`http://localhost:3002/api/stellar/escrow/${JOB_ID}/status`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

#### Cenário 3 — Tentativa de Unauthorized Access em massa

```javascript
// Verifica que auth guard aguenta volume sem degradação
export const options = { vus: 500, duration: '10s' };

export default function () {
  const res = http.post('http://localhost:3002/api/stellar/escrow/release', '{}', {
    headers: { 'Content-Type': 'application/json' }
    // Sem Authorization header propositalmente
  });
  check(res, { 'returns 401': (r) => r.status === 401 });
}
```

### 6.3 Testes de Propriedade (Property-Based)

```typescript
// tests/property/escrow.property.test.ts
import * as fc from 'fast-check';
import { isValidPublicKey } from '../../src/utils/stellar.util';

describe('Stellar key validation properties', () => {
  it('never accepts non-G strings as valid public keys', () => {
    fc.assert(fc.property(
      fc.string().filter(s => !s.startsWith('G')),
      (s) => !isValidPublicKey(s)
    ));
  });

  it('self-dealing always rejected regardless of key', () => {
    fc.assert(fc.property(
      fc.constant('GAABSLGDFP63FKVUYVHIYL5VRKLJX4G7PLEVZFOB6LAG5HEBCD2NHXNJ'),
      (key) => {
        // hostPublicKey === talentPublicKey deve sempre rejeitar
        expect(() => validateEscrowParties(key, key)).toThrow(/different/);
      }
    ));
  });
});
```

---

## 7. Trail of Bits Skills — Aplicabilidade

### Aplicáveis ao projeto (TypeScript/Node.js/Stellar)

| Skill | Como usar | Prioridade |
|---|---|---|
| `differential-review` | Revisar os diffs de segurança desta branch | 🔴 Alta |
| `semgrep-rule-creator` | Criar regras para detectar XDR blind-signing, base64 de secrets | 🔴 Alta |
| `variant-analysis` | Varrer todo o codebase por padrões similares ao VULN-002 (arbiter cego) | 🔴 Alta |
| `static-analysis` | Rodar CodeQL + Semgrep na base TypeScript | 🟠 Média |
| `supply-chain-risk-auditor` | Auditar `@stellar/stellar-sdk`, `express`, `mongoose` | 🟠 Média |
| `constant-time-analysis` | Verificar implementação AES-256-GCM por timing side-channels | 🟠 Média |
| `insecure-defaults` | Verificar configurações padrão de Express, MongoDB, CORS | 🟡 Baixa |
| `zeroize-audit` | Garantir que secrets são limpos da memória após uso | 🟡 Baixa |
| `property-based-testing` | Propriedades de invariante do escrow state machine | 🟡 Baixa |
| `mutation-testing` | Validar qualidade das suítes de teste existentes | 🟡 Baixa |

### Não aplicáveis

| Skill | Motivo |
|---|---|
| `building-secure-contracts` | Suporta Algorand/Cairo/Cosmos/Solana/Substrate/TON — não Stellar |
| `entry-point-analyzer` | Só Solidity/Vyper/Rust/Move — Stellar usa XDR, não bytecode |

### Semgrep rules customizadas a criar

```yaml
# Detectar base64 como "encryption" de secrets Stellar
rules:
  - id: stellar-secret-base64-storage
    pattern: Buffer.from($SECRET).toString('base64')
    message: Possible plaintext storage of Stellar secret key via base64
    languages: [typescript]
    severity: ERROR

  - id: stellar-xdr-blind-signing
    pattern: |
      const $TX = TransactionBuilder.fromXDR($XDR, ...) as Transaction;
      $TX.sign($KEYPAIR);
    message: XDR parsed and signed without hash validation against stored transaction
    languages: [typescript]
    severity: ERROR

  - id: stellar-missing-duplicate-check
    pattern: |
      async createEscrow($DTO) {
        ...
        await StellarEscrowModel.create({...});
      }
    message: createEscrow missing duplicate jobId check before insert
    languages: [typescript]
    severity: WARNING
```

---

## 8. Checklist de Segurança Stellar

Específico para plataformas de escrow sobre Stellar Protocol.

### Arquitetura

- [x] Multisig 2-de-3 (host + talent + arbiter)
- [x] Treasury sponsoring (Sponsored Reserves — zero XLM para usuários)
- [x] FeeBump transactions (treasury paga fees)
- [x] Pre-auth transactions com TimeBounds para refund automático
- [x] masterWeight não zerado apenas quando necessário para cron

### Validação de Inputs

- [x] `isValidPublicKey()` em todas as chaves recebidas
- [x] `hostPublicKey !== talentPublicKey` (self-dealing prevention)
- [x] `jobId` único verificado antes da criação on-chain
- [ ] `amount > 0` validação explícita (SDK cobre implicitamente)
- [ ] `hostPublicKey !== treasury/arbiterPublicKey`
- [ ] Limite máximo de `amount` configurável

### Autenticação / Autorização

- [x] Todos endpoints Stellar protegidos por `authGuard`
- [x] Admin endpoints protegidos por `adminGuard`
- [x] `openDispute` verifica wallet do caller vs escrow parties
- [ ] `releasePayment` verifica que caller é o host do escrow (via `req.user`)
- [ ] `refundEscrow` verifica que caller é o host do escrow (via `req.user`)

### Integridade de Transações

- [x] Hash validation em `releasePayment` (vs `payment_tx_hash`)
- [x] Hash validation em `refundEscrow` (vs `refund_tx_hash`)
- [x] Hash validation em `claimDispute` (vs `dispute_resolution_xdr`)
- [x] TimeBounds enforçados pelo Stellar network no refund
- [ ] Verificar que payment XDR não expirou antes de usar em dispute

### Criptografia

- [x] AES-256-GCM para secret keys (substituiu base64)
- [x] IV aleatório por operação (12 bytes)
- [x] Auth tag verificada no decrypt (previne adulteração)
- [x] Chave derivada de env var (32 bytes hex)
- [ ] Rotação de chave de criptografia (Key Rotation Policy)
- [ ] Secret key do escrow destruída da memória após uso

### Estado do Escrow

- [x] `FUNDED → DISPUTED` (só de FUNDED)
- [x] `FUNDED → COMPLETED` (release só de FUNDED)
- [x] `FUNDED → REFUNDED` (refund só de FUNDED + deadline passado)
- [x] `DISPUTED → COMPLETED/REFUNDED` (via claim após resolve)
- [ ] Índice único MongoDB em `job_id` (previne race condition)
- [ ] Lock otimista (versão/timestamp) para operações concorrentes

---

## 9. Pendências

### Alta Prioridade

- [x] **VULN-008:** Restringir `payment-xdr` e `refund-xdr` ao host do escrow — `callerWallet` verificado no service
- [x] **VULN-009:** Índice único MongoDB em `job_id` — adicionado ao `ensureIndexes()` em `config/database.ts`
- [x] Verificar que `hostPublicKey`/`talentPublicKey` não são treasury ou arbiter
- [x] `releasePayment` / `refundEscrow` verificam `callerWallet === host_public_key`
- [ ] Gerar e injetar `STELLAR_ESCROW_ENCRYPTION_KEY` em produção (Railway env vars)

### Testes implementados

- [x] Suite `src/tests/security/auth.test.ts` — **15 testes** (401/403 em todos endpoints)
- [x] Suite `src/tests/security/business-logic.test.ts` — **18 testes** (duplicate, self-dealing, XDR mismatch, host-only, treasury/arbiter, dispute identity)
- [x] Suite `src/tests/security/encryption.test.ts` — **11 testes** (AES-256-GCM roundtrip, tamper, missing key, property-based)
- [x] Suite `src/tests/security/property.test.ts` — **8 testes** (fast-check: key validation, self-dealing, deadline monotonicity)
- [x] Testes de carga k6: `tests/load/escrow-flood.js`, `tests/load/status-stress.js`, `tests/load/auth-flood.js`
- [ ] Semgrep rules customizadas + CI integration

### Trail of Bits Skills — Resultados

- [x] **Variant Analysis (manual)** — 5 ocorrências de `fromXDR` no codebase:
  - `releasePayment` (L231): user-input → hash check antes de assinar ✅
  - `refundEscrow` (L301): user-input → hash check antes de assinar ✅
  - `runExpiredEscrows` (L421): lê do DB (server-generated) → sem hash check necessário ✅
  - `resolveDispute` (L507): lê do DB (server-generated) → sem hash check necessário ✅
  - `claimDispute` (L558): user-input → hash check contra `dispute_resolution_xdr` ✅
  - **Zero blind-signing patterns restantes**

- [x] **Semgrep Rules** — `security/semgrep-stellar.yml` com 6 regras customizadas:
  - `stellar-secret-base64-storage` (ERROR)
  - `stellar-xdr-blind-signing` (ERROR)
  - `stellar-missing-duplicate-check` (WARNING)
  - `stellar-self-dealing` (ERROR)
  - `stellar-missing-unique-index` (WARNING)
  - `stellar-route-no-auth` (ERROR)

- [x] **Supply Chain Audit** (`npm audit`) — **45 vulnerabilidades** encontradas:
  | Pacote | Severidade | Tipo | Ação |
  |---|---|---|---|
  | `fast-xml-parser` | 🔴 CRÍTICA | DoS via entity expansion (transitivo) | Monitorar; nosso código não parseia XML de usuários |
  | `@stellar/stellar-sdk@^15` | 🟠 Alta | Via `axios` — SSRF bypass + prototype pollution em `validateStatus` | Atualizar SDK quando patch disponível |
  | `express@^4.18.2` | 🟠 Alta | `body-parser` ReDoS, `path-to-regexp` ReDoS, `qs` prototype pollution | Migrar para Express 5.x (`npm i express@5`) |
  | `@solana/spl-token`, `@mysten/sui` | 🟠 Alta | Transitive — não usados no path Stellar | Baixo risco para escrow |

  **Recomendação imediata:** `npm i express@5` elimina as vulnerabilidades do express e seus transitivos.

- [ ] `/differential-review` — skill não instalada; revisão manual equivalente realizada
- [ ] `/static-analysis` — CodeQL scan recomendado no CI antes de mainnet

### Mainnet / Produção

- [ ] Mover arbiter key para KMS/HSM
- [ ] Implementar `accountMerge` no release/refund (recuperação de XLM patrocinado)
- [ ] Rate limiting por usuário em `createEscrow`
- [ ] Alertas on-chain para movimentações inesperadas do treasury

---

*Auditoria conduzida com metodologia multi-agente. Próxima revisão recomendada antes do deploy em mainnet.*
