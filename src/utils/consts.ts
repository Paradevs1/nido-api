// ── App constants ──────────────────────────────────────────────────────────────
export const PLAN_CORE = 300;

// Pagination
export const MAX_PARTICIPANTS_LIMIT = 10000;
export const MAX_EXPORT_LIMIT = 100000;

// Security
export const BCRYPT_SALT_ROUNDS = 12;

// Rate limiting — global + auth + payment
export const RATE_LIMIT_GLOBAL_WINDOW_MS = 900000;    // 15 minutes
export const RATE_LIMIT_GLOBAL_MAX = 100;
export const RATE_LIMIT_AUTH_WINDOW_MS = 60000;        // 1 minute
export const RATE_LIMIT_AUTH_MAX = 10;
export const RATE_LIMIT_PAYMENT_WINDOW_MS = 60000;     // 1 minute
export const RATE_LIMIT_PAYMENT_MAX = 5;

// Rate limiting — Stellar endpoints (per-user, 1-minute window)
// SEC-OPEN-003: limit escrow creation to block treasury reserve exhaustion
export const RATE_LIMIT_STELLAR_WINDOW_MS = 60000;     // 1 minute
export const RATE_LIMIT_STELLAR_CREATE_MAX = 5;        // POST /escrow/create
export const RATE_LIMIT_STELLAR_RELEASE_MAX = 10;      // POST /escrow/release, /refund, /dispute/claim
export const RATE_LIMIT_STELLAR_STATUS_MAX = 30;       // GET /escrow/:id/status, /xdr endpoints
export const RATE_LIMIT_STELLAR_DISPUTE_MAX = 5;       // POST /dispute (open)

// External API delays (ms) — rate limiting between requests
export const API_DELAY_TWITTER_MS = 100;
export const API_DELAY_INSTAGRAM_MS = 500;
export const API_DELAY_TIKTOK_MS = 500;
export const API_DELAY_YOUTUBE_MS = 500;
export const API_DELAY_FOLLOWERS_MS = 200;

// External API timeout (ms)
export const EXTERNAL_API_TIMEOUT_MS = 15000;

// Body parser
export const BODY_LIMIT = '10mb';

export const TOKENS = {
    base: {
        USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        USDT: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
    },
    arbitrum: {
        USDC: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    },
    ethereum: {
        USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    },
    berachain: {
        USDC: "0x549943e04f40284185054145c6E4e9568C1D3241",
        HONEY: "0xfcbd14dc51f0a4d49d5e53c2e0950e0bc26d0dce",
    },
    bsc: {
        USDC: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        USDT: "0x55d398326f99059ff775485246999027b3197955",
    },
    hyperevm: {
        USDC: "0xb88339cb7199b77e23db6e890353e22632ba630f",
        USDE: "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34",
    },
    polygon: {
        USDC: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
        USDT: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
    },
    solana: {
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    },
    sui: {
        USDC: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        USDT: "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
    },
    stellar: {
        USDC: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    }
};

export const RPCS = {
    base: process.env['RPC_BASE_URL'] || '',
    arbitrum: process.env['RPC_ARBITRUM_URL'] || '',
    ethereum: process.env['RPC_ETHEREUM_URL'] || '',
    berachain: process.env['RPC_BERACHAIN_URL'] || '',
    bsc: process.env['RPC_BSC_URL'] || '',
    polygon: process.env['RPC_POLYGON_URL'] || '',
    hyperevm: process.env['RPC_HYPEREVM_URL'] || '',
    solana: process.env['RPC_SOLANA_URL'] || '',
    sui: process.env['RPC_SUI_URL'] || '',
    stellar: process.env['RPC_STELLAR_URL'] || '',
};

export const ERC20ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
];

export const WALLETS_DESTINATION = {
    sui: process.env['WALLET_DESTINATION_SUI'] || '',
    solana: process.env['WALLET_DESTINATION_SOLANA'] || '',
    evm: process.env['WALLET_DESTINATION_EVM'] || '',
    stellar: process.env['WALLET_DESTINATION_STELLAR'] || '',
};