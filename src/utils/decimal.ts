/**
 * Aritmética monetária exata para o ledger do saldo do Host.
 *
 * Regra de ouro (ver docs/ESTRATEGIA_SALDO_HOST_E_CAMPANHA_ACEITACAO/04 §6):
 * NUNCA usar `Number` para somar saldo em casas decimais. Todo valor monetário é
 * convertido para **unidades mínimas inteiras** (minor units) do token e só então
 * somado/comparado. Ex.: USDC tem 6 casas → "10.50" = 10_500_000 minor units.
 *
 * As operações sobre minor units são feitas em `bigint` internamente (exatas e sem
 * teto prático) e devolvidas como `number` inteiro para armazenamento no Mongo,
 * sempre validando que permanecem dentro de Number.MAX_SAFE_INTEGER.
 */

/** Casas decimais por token. Fallback = 6 (padrão das stablecoins USDC/USDT). */
export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  XLM: 7,
};

const DEFAULT_DECIMALS = 6;

export function getTokenDecimals(token: string): number {
  const d = TOKEN_DECIMALS[token.toUpperCase()];
  return d === undefined ? DEFAULT_DECIMALS : d;
}

function assertSafeInteger(value: bigint, context: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`decimal: ${context} fora do intervalo seguro de inteiro (${value.toString()})`);
  }
  return Number(value);
}

/**
 * Converte um valor decimal ("10.50" ou 10.5) em unidades mínimas inteiras do token.
 * Rejeita valores com precisão maior que a do token, NaN, infinito ou notação inválida.
 */
export function toMinor(amount: string | number, token: string): number {
  const decimals = getTokenDecimals(token);
  const raw = typeof amount === 'number' ? numberToFixedString(amount, decimals) : amount.trim();

  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`decimal: valor monetário inválido "${amount}"`);
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const dot = unsigned.indexOf('.');
  const intPart = dot === -1 ? unsigned : unsigned.slice(0, dot);
  const fracPart = dot === -1 ? '' : unsigned.slice(dot + 1);

  if (fracPart.length > decimals) {
    throw new Error(
      `decimal: "${amount}" tem mais de ${decimals} casas decimais permitidas para ${token}`
    );
  }

  const paddedFrac = fracPart.padEnd(decimals, '0');
  const combined = `${intPart}${paddedFrac}`.replace(/^0+(?=\d)/, '');
  const magnitude = BigInt(combined === '' ? '0' : combined);
  const signed = negative ? -magnitude : magnitude;
  return assertSafeInteger(signed, `toMinor("${amount}", ${token})`);
}

/** Converte unidades mínimas inteiras de volta para string decimal canônica. */
export function fromMinor(minor: number, token: string): string {
  if (!Number.isInteger(minor)) {
    throw new Error(`decimal: minor units precisa ser inteiro, recebido ${minor}`);
  }
  const decimals = getTokenDecimals(token);
  const negative = minor < 0;
  const digits = Math.abs(minor).toString().padStart(decimals + 1, '0');
  const cut = digits.length - decimals;
  const intPart = digits.slice(0, cut);
  const fracPart = digits.slice(cut).replace(/0+$/, '');
  const body = fracPart === '' ? intPart : `${intPart}.${fracPart}`;
  return negative ? `-${body}` : body;
}

/** Soma de minor units (inteiros), validando o intervalo seguro. */
export function addMinor(a: number, b: number): number {
  return assertSafeInteger(BigInt(a) + BigInt(b), 'addMinor');
}

/** Subtração de minor units (inteiros), validando o intervalo seguro. */
export function subMinor(a: number, b: number): number {
  return assertSafeInteger(BigInt(a) - BigInt(b), 'subMinor');
}

/** -1 se a<b, 0 se igual, 1 se a>b. */
export function cmpMinor(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Valida que um valor de depósito/saque/reserva é estritamente positivo. */
export function isPositiveAmount(minor: number): boolean {
  return Number.isInteger(minor) && minor > 0;
}

function numberToFixedString(n: number, decimals: number): string {
  if (!Number.isFinite(n)) {
    throw new Error(`decimal: número não finito "${n}"`);
  }
  // toFixed limita a precisão; a validação de regex/precisão acontece em toMinor.
  return n.toFixed(decimals);
}
