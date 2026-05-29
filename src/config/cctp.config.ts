import { stellarConfig } from './stellar';

/**
 * CCTP V2 (Circle Cross-Chain Transfer Protocol) configuration.
 *
 * Inbound model (this phase): a host holding native USDC on any CCTP source
 * chain burns it there (`depositForBurnWithHook`) targeting the Stellar
 * `CctpForwarder`, which mints USDC on Stellar and forwards it to the escrow's
 * classic G-account. The backend relays the mint by calling
 * `mint_and_forward(message, attestation)` on the forwarder once Circle's Iris
 * service has attested the burn.
 *
 * Stellar CCTP runs on Soroban (domain 27). All native escrow guarantees
 * (multisig, timebound refund, account merge) stay on Stellar Classic — CCTP
 * only sits at the funding edge, BEFORE the trust envelope.
 */

export type CctpNetwork = 'testnet' | 'mainnet';

// Stellar's own CCTP domain. USDC minted here lands on the escrow account.
export const STELLAR_CCTP_DOMAIN = 27;

/**
 * CCTP V2 minFinalityThreshold:
 *   2000 = Standard (waits for source-chain hard finality; no fast fee)
 *   1000 = Fast Transfer (faster, charges maxFee where supported)
 * Default to Standard — safest for an escrow funding step.
 */
export const FINALITY_STANDARD = 2000;
export const FINALITY_FAST = 1000;

interface CctpContracts {
  tokenMessengerMinter: string;
  messageTransmitter: string;
  cctpForwarder: string;
}

// Stellar Soroban CCTP contracts (domain 27). Same function names on both nets.
export const STELLAR_CCTP_CONTRACTS_BY_NET: Record<CctpNetwork, CctpContracts> = {
  mainnet: {
    tokenMessengerMinter: 'CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL',
    messageTransmitter: 'CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV',
    cctpForwarder: 'CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T',
  },
  testnet: {
    tokenMessengerMinter: 'CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP',
    messageTransmitter: 'CBJ6MTCKKZG73PMDZCJMSFRD7DQEMI4FKDH7CGDSV4W6FHCRBCQAVVJY',
    cctpForwarder: 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ',
  },
};

// Circle Iris attestation service (V2). Sandbox for testnet, prod for mainnet.
const IRIS_BASE_URL: Record<CctpNetwork, string> = {
  mainnet: 'https://iris-api.circle.com',
  testnet: 'https://iris-api-sandbox.circle.com',
};

// Default Soroban RPC endpoints (override with STELLAR_SOROBAN_RPC_URL).
export const SOROBAN_RPC_BY_NET: Record<CctpNetwork, string> = {
  mainnet: 'https://mainnet.sorobanrpc.com',
  testnet: 'https://soroban-testnet.stellar.org',
};

/**
 * Supported CCTP source chains the host can burn FROM, keyed by a stable slug.
 * `domain` is Circle's CCTP domain id (NOT an EVM chainId). `usdc` is the burn
 * token address on that chain, per network.
 */
export interface CctpSourceChain {
  slug: string;
  label: string;
  domain: number;
  // Burn integration differs by VM family: EVM uses TokenMessengerV2.depositForBurnWithHook,
  // Solana uses the CCTP program, Sui uses a Move call into the token_messenger_minter package.
  kind: 'evm' | 'solana' | 'sui';
  usdc: { testnet: string; mainnet: string };
}

export const CCTP_SOURCE_CHAINS: Record<string, CctpSourceChain> = {
  ethereum: {
    slug: 'ethereum',
    label: 'Ethereum',
    domain: 0,
    kind: 'evm',
    usdc: {
      mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      testnet: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
    },
  },
  arbitrum: {
    slug: 'arbitrum',
    label: 'Arbitrum',
    domain: 3,
    kind: 'evm',
    usdc: {
      mainnet: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      testnet: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
    },
  },
  base: {
    slug: 'base',
    label: 'Base',
    domain: 6,
    kind: 'evm',
    usdc: {
      mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      testnet: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
    },
  },
  polygon: {
    slug: 'polygon',
    label: 'Polygon PoS',
    domain: 7,
    kind: 'evm',
    usdc: {
      mainnet: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      testnet: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Amoy
    },
  },
  solana: {
    slug: 'solana',
    label: 'Solana',
    domain: 5,
    kind: 'solana',
    usdc: {
      mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      testnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet
    },
  },
  sui: {
    slug: 'sui',
    label: 'Sui',
    domain: 8,
    kind: 'sui',
    usdc: {
      // Coin type (matches src/utils/consts.ts TOKENS.sui.USDC)
      mainnet: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
      // TODO(testnet): fill Circle's Sui testnet USDC coin type before enabling Sui on testnet.
      testnet: '',
    },
  },
};

const network = stellarConfig.network as CctpNetwork;

export const cctpConfig = {
  network,
  enabled: process.env['CCTP_ENABLED'] === 'true',
  stellarDomain: STELLAR_CCTP_DOMAIN,
  contracts: STELLAR_CCTP_CONTRACTS_BY_NET[network],
  irisBaseUrl: process.env['CCTP_IRIS_BASE_URL'] || IRIS_BASE_URL[network],
  sorobanRpcUrl: process.env['STELLAR_SOROBAN_RPC_URL'] || SOROBAN_RPC_BY_NET[network],
  // Optional Bearer token for the Iris sandbox/prod API.
  irisApiKey: process.env['CCTP_IRIS_API_KEY'] || '',
  // Standard finality by default — no fast-transfer fee on the funding step.
  defaultFinalityThreshold: FINALITY_STANDARD,
  sourceChains: CCTP_SOURCE_CHAINS,
};

export function getSourceChain(slug: string): CctpSourceChain {
  const chain = CCTP_SOURCE_CHAINS[slug];
  if (!chain) {
    const supported = Object.keys(CCTP_SOURCE_CHAINS).join(', ');
    throw new Error(`Unsupported CCTP source chain "${slug}". Supported: ${supported}`);
  }
  return chain;
}

export function getSourceUsdcAddress(slug: string): string {
  return getSourceChain(slug).usdc[network];
}
