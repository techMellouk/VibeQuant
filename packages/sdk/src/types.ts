/**
 * Normalized VibeQuant state models.
 *
 * These are the only shapes the frontend and LLM ever see. They are decoupled
 * from the raw Alpha Arcade wire formats (see `normalize.ts`). All prices and
 * probabilities are 0..1 decimals, all amounts are whole shares / USDC, and all
 * timestamps are ms epoch.
 */

import type { TransactionSigner } from "algosdk";

export type Outcome = "YES" | "NO";
export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";
export type OrderStatus = "OPEN" | "PARTIAL" | "FILLED";

/** A prediction market with normalized live probabilities. */
export interface MarketState {
  /** Alpha market id (UUID from API, or app id string on-chain). */
  id: string;
  marketAppId: number;
  title: string;
  slug?: string;
  image?: string;
  categories: string[];
  yesAssetId: number;
  noAssetId: number;
  /** YES probability in 0..1 (API only). */
  yesProbability?: number;
  /** NO probability in 0..1 (API only). */
  noProbability?: number;
  /** Trading volume in USDC (API only). */
  volume?: number;
  /** Resolution / end time as ms epoch. */
  endTime?: number;
  isResolved: boolean;
  isLive: boolean;
  /** Fee base as a fraction (0.07 = 7%). */
  feeBasePercent?: number;
  source?: "onchain" | "api";
  /** When this record was last refreshed (ms epoch). */
  updatedAt: number;
}

export interface OrderBookLevel {
  /** Price in 0..1. */
  price: number;
  /** Quantity in shares. */
  quantity: number;
  escrowAppId?: number;
  owner?: string;
}

export interface OrderBookSideState {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface OrderBookState {
  marketId: string;
  marketAppId: number;
  yes: OrderBookSideState;
  no: OrderBookSideState;
  /** Spread between best YES bid/ask in 0..1, if computable. */
  spread?: number;
  updatedAt: number;
}

export interface AccountState {
  walletAddress: string;
  /** Spendable USDC balance. */
  usdcBalance: number;
  /** Native ALGO balance (needed to pay txn fees / min balance). */
  algoBalance: number;
  updatedAt: number;
}

export interface PositionState {
  marketAppId: number;
  marketId?: string;
  title?: string;
  yesAssetId: number;
  noAssetId: number;
  /** YES shares held. */
  yesShares: number;
  /** NO shares held. */
  noShares: number;
  /** Mark-to-market value of YES shares (using current probability), if known. */
  yesValue?: number;
  noValue?: number;
  /** Total mark-to-market value of the position, if known. */
  value?: number;
  updatedAt: number;
}

export interface OrderState {
  escrowAppId: number;
  marketAppId: number;
  side: OrderSide;
  outcome: Outcome;
  /** Limit price in 0..1. */
  price: number;
  /** Total quantity in shares. */
  quantity: number;
  /** Filled quantity in shares. */
  quantityFilled: number;
  /** Remaining (unfilled) quantity in shares. */
  remainingQuantity: number;
  status: OrderStatus;
  type: OrderType;
  owner: string;
  updatedAt: number;
}

export interface PortfolioState {
  walletAddress: string;
  usdcBalance: number;
  /** Combined mark-to-market value of all positions. */
  positionsValue: number;
  /** usdcBalance + positionsValue. */
  totalValue: number;
  /** Per-market net exposure (value at risk) keyed by marketAppId. */
  exposureByMarket: Record<number, number>;
  updatedAt: number;
}

/** Result returned by trading actions. */
export interface TradeResult {
  success: boolean;
  escrowAppId?: number;
  txIds: string[];
  confirmedRound?: number;
  /** Quantity matched immediately, in shares. */
  matchedQuantity?: number;
  /** Weighted average fill price in 0..1. */
  matchedPrice?: number;
}

/** Parameters for placing an order, in normalized units. */
export interface PlaceOrderParams {
  marketAppId: number;
  outcome: Outcome;
  /** True for a buy, false for a sell. */
  isBuying: boolean;
  /** Limit price in 0..1. For market orders this is the worst acceptable price. */
  price: number;
  /** Quantity in shares. */
  quantity: number;
  /** Slippage tolerance in 0..1 (market orders only, default 0.02). */
  slippage?: number;
  /** Override fee base fraction; otherwise read from market state. */
  feeBasePercent?: number;
}

/** Network / wiring configuration. */
export interface VibeQuantConfig {
  /** Algorand address that owns positions and signs trades. */
  walletAddress: string;
  /** Alpha Arcade partner API key. Optional, but enables richer data. */
  alphaArcadeApiKey?: string;
  /**
   * 25-word Algorand mnemonic used to derive a server-side signer.
   * Mutually exclusive with `signer`. SERVER-SIDE ONLY — never expose to a browser.
   */
  mnemonic?: string;
  /**
   * Pre-built transaction signer (e.g. a browser wallet). Preferred over
   * `mnemonic` for client-side signing. If neither is provided the client runs
   * in read-only mode and trading methods throw.
   */
  signer?: TransactionSigner;

  /** Mainnet contract / asset ids (defaults applied if omitted). */
  matcherAppId?: number;
  usdcAssetId?: number;

  /** Endpoint overrides. */
  algodServer?: string;
  algodPort?: number;
  algodToken?: string;
  indexerServer?: string;
  indexerPort?: number;
  indexerToken?: string;
  apiBaseUrl?: string;
  wsUrl?: string;

  /** Poll interval (ms) for account/positions/orders refresh. 0 disables. */
  pollIntervalMs?: number;
}

/** Live-state change events emitted by the client. */
export type VibeQuantEventMap = {
  connected: void;
  disconnected: void;
  markets: MarketState[];
  orderbook: OrderBookState;
  account: AccountState;
  positions: PositionState[];
  orders: OrderState[];
  portfolio: PortfolioState;
  error: Error;
};

export type VibeQuantEvent = keyof VibeQuantEventMap;
