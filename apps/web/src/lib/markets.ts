/** Helper to load normalized markets from the SDK, or demo data in demo mode. */

import type { MarketState } from "@vibequant/sdk";
import { getClient } from "./sdk";
import { DEMO_MARKETS } from "./demo";

/**
 * Optional minimum lifetime volume (USD) for a market to be shown.
 *
 * Default is 0 (no filtering). Alpha Arcade's API only reports volume for a
 * small fraction of markets (most come back 0/undefined), so any positive
 * threshold silently hides the vast majority of real, tradeable markets —
 * including multi-choice markets like the FIFA World Cup winner. Set
 * MIN_MARKET_VOLUME_USD explicitly to opt back in.
 */
export const MIN_MARKET_VOLUME_USD = Number(process.env.MIN_MARKET_VOLUME_USD ?? "0");

export function filterLiquidMarkets(markets: MarketState[]): MarketState[] {
  if (!Number.isFinite(MIN_MARKET_VOLUME_USD) || MIN_MARKET_VOLUME_USD <= 0) {
    return markets;
  }
  // When a threshold is set, only drop markets whose volume is KNOWN to be
  // below it; keep markets with unreported volume so we don't lose them.
  return markets.filter(
    (m) => m.volume === undefined || m.volume >= MIN_MARKET_VOLUME_USD,
  );
}

export async function loadMarkets(): Promise<{ markets: MarketState[]; demo: boolean }> {
  const client = await getClient();
  if (!client) return { markets: filterLiquidMarkets(DEMO_MARKETS), demo: true };
  try {
    const markets = filterLiquidMarkets(client.getMarkets());
    if (markets.length === 0) return { markets: filterLiquidMarkets(DEMO_MARKETS), demo: true };
    return { markets, demo: false };
  } catch {
    return { markets: filterLiquidMarkets(DEMO_MARKETS), demo: true };
  }
}
