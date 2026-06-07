import type {
  Market,
  MarketOption,
  Orderbook,
  OpenOrder,
  WalletPosition,
  WsOrderbookApp,
  WsOrderbookDetailEntry,
  OrderbookEntry,
} from "@alpha-arcade/sdk";

import type {
  MarketState,
  OrderBookLevel,
  OrderBookSideState,
  OrderBookState,
  OrderState,
  PositionState,
} from "./types";
import { feeBaseToFraction, microPriceToDecimal, microToDecimal, secondsToMs } from "./units";

const now = () => Date.now();

/**
 * The Alpha API reports probabilities as percentages (e.g. 40 means 40% = $0.40),
 * NOT 0..1 decimals. Convert to 0..1. On-chain markets omit probabilities.
 */
function probToDecimal(prob: number | undefined): number | undefined {
  return prob === undefined || prob === null ? undefined : prob / 100;
}

export function normalizeMarket(m: Market): MarketState {
  return {
    id: m.id,
    marketAppId: m.marketAppId,
    title: m.title,
    slug: m.slug,
    image: m.image,
    categories: m.categories ?? [],
    yesAssetId: m.yesAssetId,
    noAssetId: m.noAssetId,
    yesProbability: probToDecimal(m.yesProb),
    noProbability: probToDecimal(m.noProb),
    // The API already reports volume in dollars (not microunits).
    volume: m.volume,
    endTime: secondsToMs(m.endTs),
    isResolved: m.isResolved ?? false,
    isLive: m.isLive ?? true,
    feeBasePercent: m.feeBase !== undefined ? feeBaseToFraction(m.feeBase) : undefined,
    source: m.source,
    updatedAt: now(),
  };
}

/**
 * Expand a market into its tradeable units.
 *
 * Multi-choice markets (e.g. "Who wins the election?") carry an `options[]`
 * array where each option is its own binary market with its own `marketAppId`.
 * The parent is NOT directly tradeable, so we flatten each option into a
 * standalone MarketState and drop the parent.
 */
export function expandMarket(m: Market): MarketState[] {
  if (!m.options || m.options.length === 0) return [normalizeMarket(m)];
  return m.options.map((opt) => normalizeOption(m, opt));
}

function normalizeOption(parent: Market, opt: MarketOption): MarketState {
  return {
    id: opt.id || `${parent.id}:${opt.marketAppId}`,
    marketAppId: opt.marketAppId,
    title: `${parent.title}: ${opt.title}`,
    slug: parent.slug,
    image: parent.image,
    categories: parent.categories ?? [],
    yesAssetId: opt.yesAssetId,
    noAssetId: opt.noAssetId,
    yesProbability: probToDecimal(opt.yesProb),
    noProbability: probToDecimal(opt.noProb),
    volume: parent.volume,
    endTime: secondsToMs(parent.endTs),
    isResolved: parent.isResolved ?? false,
    isLive: parent.isLive ?? true,
    feeBasePercent: parent.feeBase !== undefined ? feeBaseToFraction(parent.feeBase) : undefined,
    source: parent.source,
    updatedAt: now(),
  };
}

function sortLevels(levels: OrderBookLevel[], descending: boolean): OrderBookLevel[] {
  return [...levels].sort((a, b) => (descending ? b.price - a.price : a.price - b.price));
}

function levelFromEntry(entry: OrderbookEntry): OrderBookLevel {
  return {
    price: microPriceToDecimal(entry.price),
    quantity: microToDecimal(entry.quantity),
    escrowAppId: entry.escrowAppId,
    owner: entry.owner,
  };
}

function levelFromWsEntry(entry: WsOrderbookDetailEntry): OrderBookLevel {
  return {
    price: microPriceToDecimal(entry.price),
    quantity: microToDecimal(entry.quantity),
    escrowAppId: entry.escrowAppId,
    owner: entry.owner,
  };
}

function buildSide(bids: OrderBookLevel[], asks: OrderBookLevel[]): OrderBookSideState {
  return { bids: sortLevels(bids, true), asks: sortLevels(asks, false) };
}

/** Spread between the best YES ask and best YES bid, in 0..1. */
function computeSpread(side: OrderBookSideState): number | undefined {
  const bestBid = side.bids[0];
  const bestAsk = side.asks[0];
  if (!bestBid || !bestAsk) return undefined;
  return Math.max(0, bestAsk.price - bestBid.price);
}

export function normalizeOnChainOrderbook(
  marketId: string,
  marketAppId: number,
  ob: Orderbook,
): OrderBookState {
  const yes = buildSide(ob.yes.bids.map(levelFromEntry), ob.yes.asks.map(levelFromEntry));
  const no = buildSide(ob.no.bids.map(levelFromEntry), ob.no.asks.map(levelFromEntry));
  return { marketId, marketAppId, yes, no, spread: computeSpread(yes), updatedAt: now() };
}

export function normalizeWsOrderbook(
  marketId: string,
  marketAppId: number,
  app: WsOrderbookApp,
): OrderBookState {
  const yes = buildSide(app.yes.bids.map(levelFromWsEntry), app.yes.asks.map(levelFromWsEntry));
  const no = buildSide(app.no.bids.map(levelFromWsEntry), app.no.asks.map(levelFromWsEntry));
  return { marketId, marketAppId, yes, no, spread: computeSpread(yes), updatedAt: now() };
}

export function normalizePosition(p: WalletPosition): PositionState {
  return {
    marketAppId: p.marketAppId,
    title: p.title,
    yesAssetId: p.yesAssetId,
    noAssetId: p.noAssetId,
    yesShares: microToDecimal(p.yesBalance),
    noShares: microToDecimal(p.noBalance),
    updatedAt: now(),
  };
}

export function normalizeOrder(o: OpenOrder): OrderState {
  const quantity = microToDecimal(o.quantity);
  const quantityFilled = microToDecimal(o.quantityFilled);
  const status: OrderState["status"] =
    quantityFilled <= 0 ? "OPEN" : quantityFilled < quantity ? "PARTIAL" : "FILLED";
  return {
    escrowAppId: o.escrowAppId,
    marketAppId: o.marketAppId,
    side: o.side === 1 ? "BUY" : "SELL",
    outcome: o.position === 1 ? "YES" : "NO",
    price: microPriceToDecimal(o.price),
    quantity,
    quantityFilled,
    remainingQuantity: Math.max(0, quantity - quantityFilled),
    status,
    type: o.slippage && o.slippage > 0 ? "MARKET" : "LIMIT",
    owner: o.owner,
    updatedAt: now(),
  };
}
