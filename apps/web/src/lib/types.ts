/**
 * Shared application types for the VibeQuant backend + frontend.
 * These are the contract between API routes and the UI.
 */

import type { MarketState } from "@vibequant/sdk";

export type Outcome = "YES" | "NO";
export type OrderType = "MARKET" | "LIMIT";

/** Output of the market discovery engine. */
export interface DiscoveryResult {
  thesis: string;
  entities: string[];
  themes: string[];
  markets: DiscoveredMarket[];
}

export interface DiscoveredMarket {
  marketId: string;
  marketAppId: number;
  question: string;
  slug?: string;
  relevance: number;
  relationship: "direct" | "indirect";
  reason: string;
  yesProbability?: number;
  noProbability?: number;
  volume?: number;
}

/** A single trade proposed inside a strategy. */
export interface ProposedTrade {
  marketId: string;
  marketAppId: number;
  marketQuestion: string;
  outcome: Outcome;
  orderType: OrderType;
  /** Capital allocated to this trade, in USDC. */
  amount: number;
  /** Limit price in 0..1 (for LIMIT orders). */
  limitPrice?: number;
  reasoning: string;
}

/** A complete trading strategy returned by the LLM strategy engine. */
export interface Strategy {
  id: string;
  thesis: string;
  explanation: string;
  trades: ProposedTrade[];
  totalCapital: number;
  maximumLoss: number;
  confidence: number;
  risks: string[];
  /** External paid signals folded into the strategy. */
  signals?: StrategySignal[];
  createdAt: number;
}

export interface StrategySignal {
  provider: string;
  summary: string;
  costUsdc: number;
}

/** A chat message in the conversation. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "thesis" | "interpretation" | "strategy" | "execution" | "text";
  discovery?: DiscoveryResult;
  strategy?: Strategy;
  execution?: ExecutionReport;
  createdAt: number;
}

/** Result of executing an approved strategy. */
export interface ExecutionReport {
  strategyId: string;
  results: ExecutionLeg[];
  allFilled: boolean;
}

export interface ExecutionLeg {
  marketQuestion: string;
  outcome: Outcome;
  amount: number;
  status: "filled" | "partial" | "failed" | "skipped";
  txIds: string[];
  filledQuantity?: number;
  fillPrice?: number;
  message?: string;
}

/** An entry in the activity log (see CURSOR.md §8). */
export type ActivityType =
  | "thesis_submitted"
  | "market_discovered"
  | "market_selected"
  | "signal_purchased"
  | "strategy_generated"
  | "strategy_modified"
  | "strategy_approved"
  | "trade_submitted"
  | "trade_filled"
  | "position_updated"
  | "error";

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: ActivityType;
  description: string;
  marketQuestion?: string;
  reference?: string;
  costUsdc?: number;
  status?: string;
}

/** Snapshot returned by /api/portfolio for the dashboard. */
export interface PortfolioSnapshot {
  connected: boolean;
  demo: boolean;
  canTrade: boolean;
  walletAddress?: string;
  account?: {
    usdcBalance: number;
    algoBalance: number;
  };
  portfolio?: {
    positionsValue: number;
    totalValue: number;
  };
  positions: PositionRow[];
  orders: OrderRow[];
}

export interface PositionRow {
  marketQuestion: string;
  outcome: Outcome;
  shares: number;
  entryPrice?: number;
  currentPrice?: number;
  value?: number;
  unrealizedPnl?: number;
}

export interface OrderRow {
  marketQuestion: string;
  outcome: Outcome;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  filled: number;
  status: string;
}

export type { MarketState };
