/**
 * Verificação on-chain dos contratos CCTP V2 na Stellar (Soroban).
 *
 * RISCO #1 do plano inbound: antes de codar o service, confirmar que os
 * contratos do forwarder/transmitter/messenger existem de verdade na rede e
 * expõem as funções que o relay vai chamar — principalmente `mint_and_forward`
 * no CctpForwarder. Se não existir, não adianta seguir.
 *
 * Faz fetch do WASM de cada contrato via Soroban RPC, parseia o contract spec
 * e lista as funções. Marca ✓/✗ se a função esperada está presente.
 *
 * Uso:
 *   npx ts-node scripts/cctp-contract-check.ts            # rede do .env (STELLAR_NETWORK)
 *   npx ts-node scripts/cctp-contract-check.ts testnet
 *   npx ts-node scripts/cctp-contract-check.ts mainnet
 *   npx ts-node scripts/cctp-contract-check.ts both
 */

import dotenv from 'dotenv';
dotenv.config();

import { contract, Networks } from '@stellar/stellar-sdk';
import {
  STELLAR_CCTP_CONTRACTS_BY_NET,
  SOROBAN_RPC_BY_NET,
  type CctpNetwork,
} from '../src/config/cctp.config';

// Funções que o RELAY chama de fato no fluxo inbound. O backend só toca o
// forwarder (mint_and_forward); o transmitter é checado por sanidade. O
// tokenMessengerMinter é chamado internamente pelo transmitter (handle_recv_*),
// nunca direto — por isso não entra aqui. O script lista TODAS as funções de
// qualquer forma, então dá pra inspecionar o resto manualmente.
const EXPECTED: Record<string, string[]> = {
  cctpForwarder: ['mint_and_forward'],
  messageTransmitter: ['receive_message'],
};

const NET_PASSPHRASE: Record<CctpNetwork, string> = {
  mainnet: Networks.PUBLIC,
  testnet: Networks.TESTNET,
};

let failures = 0;

async function listFns(contractId: string, rpcUrl: string, networkPassphrase: string): Promise<string[]> {
  const client = await contract.Client.from({ contractId, rpcUrl, networkPassphrase });
  // spec.funcs() → xdr.ScSpecFunctionV0[]; name() pode vir como Buffer/string
  return client.spec.funcs().map((f: any) => f.name().toString());
}

async function checkNetwork(net: CctpNetwork): Promise<void> {
  const contracts = STELLAR_CCTP_CONTRACTS_BY_NET[net];
  const rpcUrl = process.env['STELLAR_SOROBAN_RPC_URL'] || SOROBAN_RPC_BY_NET[net];
  const passphrase = NET_PASSPHRASE[net];

  console.log(`\n── CCTP on-chain check — ${net.toUpperCase()} ──────────────────────`);
  console.log(`RPC: ${rpcUrl}\n`);

  for (const [key, contractId] of Object.entries(contracts)) {
    process.stdout.write(`[${key}] ${contractId}\n`);
    try {
      const fns = await listFns(contractId, rpcUrl, passphrase);
      console.log(`  ✓ existe — ${fns.length} função(ões): ${fns.join(', ')}`);
      for (const want of EXPECTED[key] || []) {
        if (fns.includes(want)) console.log(`  ✓ expõe \`${want}\``);
        else { console.log(`  ✗ NÃO expõe \`${want}\` (esperado)`); failures++; }
      }
    } catch (e: any) {
      console.log(`  ✗ falhou: ${e?.message || e}`);
      failures++;
    }
    console.log();
  }
}

async function main() {
  const arg = (process.argv[2] || process.env['STELLAR_NETWORK'] || 'mainnet').toLowerCase();
  const nets: CctpNetwork[] = arg === 'both' ? ['testnet', 'mainnet'] : [arg as CctpNetwork];

  for (const net of nets) {
    if (net !== 'testnet' && net !== 'mainnet') {
      console.error(`Rede inválida: ${net} (use testnet | mainnet | both)`);
      process.exit(1);
    }
    await checkNetwork(net);
  }

  console.log('──────────────────────────────────────────────────────────');
  if (failures === 0) {
    console.log('✅ Contratos CCTP verificados — pode seguir com o service inbound.\n');
    process.exit(0);
  } else {
    console.log(`❌ ${failures} problema(s) — NÃO codar o relay até resolver.\n`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('Erro fatal:', e); process.exit(1); });
