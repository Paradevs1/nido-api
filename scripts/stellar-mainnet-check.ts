/**
 * Health-check pré-mainnet do Stellar Escrow.
 * Valida que tudo está pronto para o primeiro escrow real:
 *   - rede = mainnet
 *   - keypairs derivam corretamente
 *   - treasury existe e está fundeada com XLM suficiente
 *   - chave de encriptação válida (round-trip)
 *   - issuer USDC = Circle mainnet
 *
 * Uso: npx ts-node scripts/stellar-mainnet-check.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { Keypair, Horizon } from '@stellar/stellar-sdk';
import { encryptSecret, decryptSecret } from '../src/utils/stellar-crypto';

const MAINNET_USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const RESERVE_PER_ESCROW = 3; // XLM travados por escrow ativo (devolvidos no merge)
const TREASURY_BASE_RESERVE = 1; // XLM permanente só pra conta existir

let failures = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { console.log(`  ✗ ${m}`); failures++; };
const warn = (m: string) => console.log(`  ⚠ ${m}`);

function checkKeypair(label: string, pub?: string, sec?: string): void {
  if (!pub || !sec) { bad(`${label}: public/secret não configurados no .env`); return; }
  try {
    const derived = Keypair.fromSecret(sec).publicKey();
    if (derived === pub) ok(`${label}: secret deriva ${pub}`);
    else bad(`${label}: MISMATCH — secret deriva ${derived}, esperado ${pub}`);
  } catch (e: any) {
    bad(`${label}: secret inválido — ${e.message}`);
  }
}

async function main() {
  console.log('\n── Stellar Mainnet Health-Check ──────────────────────────\n');

  // 1. Rede
  const network = process.env['STELLAR_NETWORK'];
  console.log('[1] Rede');
  if (network === 'mainnet') ok('STELLAR_NETWORK=mainnet');
  else bad(`STELLAR_NETWORK=${network} (esperado: mainnet)`);

  // 2. Keypairs
  console.log('\n[2] Keypairs');
  const treasuryPub = process.env['STELLAR_TREASURY_PUBLIC_KEY'];
  const arbiterPub = process.env['STELLAR_ARBITER_PUBLIC_KEY'];
  checkKeypair('Treasury', treasuryPub, process.env['STELLAR_TREASURY_SECRET_KEY']);
  checkKeypair('Arbiter ', arbiterPub, process.env['STELLAR_ARBITER_SECRET_KEY']);

  // 3. Encryption key (round-trip real)
  console.log('\n[3] Chave de encriptação');
  try {
    const sample = Keypair.random().secret();
    if (decryptSecret(encryptSecret(sample)) === sample) ok('AES-256-GCM round-trip OK');
    else bad('round-trip falhou (encrypt→decrypt não bateu)');
  } catch (e: any) {
    bad(`STELLAR_ESCROW_ENCRYPTION_KEY: ${e.message}`);
  }

  // 4. USDC issuer
  console.log('\n[4] USDC issuer');
  const issuer = process.env['STELLAR_USDC_ISSUER'];
  if (issuer === MAINNET_USDC_ISSUER) ok('Circle USDC mainnet');
  else warn(`STELLAR_USDC_ISSUER=${issuer} (Circle mainnet é ${MAINNET_USDC_ISSUER})`);

  // 5. Treasury on-chain (existência + saldo)
  console.log('\n[5] Treasury on-chain (mainnet)');
  if (treasuryPub) {
    const server = new Horizon.Server('https://horizon.stellar.org');
    try {
      const acct = await server.loadAccount(treasuryPub);
      const xlm = acct.balances.find((b: any) => b.asset_type === 'native')?.balance ?? '0';
      const xlmNum = parseFloat(xlm);
      ok(`conta existe — saldo: ${xlm} XLM`);
      const usableForEscrows = xlmNum - TREASURY_BASE_RESERVE;
      const capacity = Math.max(0, Math.floor(usableForEscrows / RESERVE_PER_ESCROW));
      if (xlmNum < 4) bad(`saldo baixo — precisa de ≥4 XLM para 1 escrow (1 reserve própria + 3 patrocinados)`);
      else ok(`capacidade: ~${capacity} escrow(s) ativo(s) simultâneo(s) (${RESERVE_PER_ESCROW} XLM cada, devolvidos no merge)`);
    } catch (e: any) {
      if (e?.response?.status === 404) bad('conta NÃO existe na mainnet — fundeie com XLM real primeiro');
      else bad(`erro ao consultar Horizon: ${e.message}`);
    }
  }

  console.log('\n──────────────────────────────────────────────────────────');
  if (failures === 0) {
    console.log('✅ TUDO PRONTO — pode criar o primeiro escrow na mainnet.\n');
    process.exit(0);
  } else {
    console.log(`❌ ${failures} problema(s) — resolva antes de operar na mainnet.\n`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('Erro fatal:', e); process.exit(1); });
