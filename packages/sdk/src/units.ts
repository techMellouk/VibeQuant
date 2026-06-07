/**
 * Unit conversion helpers.
 *
 * Alpha Arcade represents prices, share quantities and USDC amounts in
 * microunits where 1_000_000 = $1.00 (or 1 share). VibeQuant normalizes
 * everything the frontend / LLM sees into human-friendly decimals:
 *
 *  - prices & probabilities -> 0..1 (a $0.50 price === 0.5)
 *  - share quantities       -> whole shares (1_000_000 -> 1)
 *  - USDC amounts           -> dollars (1_000_000 -> 1)
 *  - fee base               -> fraction (70_000 -> 0.07)
 *  - timestamps             -> ms epoch (seconds * 1000)
 */

const MICRO = 1_000_000;

export function microToDecimal(value: number | bigint | undefined | null): number {
  if (value === undefined || value === null) return 0;
  return Number(value) / MICRO;
}

export function decimalToMicro(value: number): number {
  return Math.round(value * MICRO);
}

/** Price in microunits (0..1_000_000) -> probability/price in 0..1. */
export const microPriceToDecimal = microToDecimal;

/** Probability/price in 0..1 -> price in microunits. */
export const decimalPriceToMicro = decimalToMicro;

/** Fee base in microunits (70_000 = 7%) -> fraction (0.07). */
export const feeBaseToFraction = microToDecimal;

/** Resolution/end timestamp in seconds -> ms epoch. Passes through ms values. */
export function secondsToMs(ts: number | undefined | null): number | undefined {
  if (ts === undefined || ts === null || ts === 0) return undefined;
  // Heuristic: values < 1e12 are seconds, otherwise already ms.
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}
