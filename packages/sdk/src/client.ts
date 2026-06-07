import { checkAssetOptIn } from "@alpha-arcade/sdk";
import type { AlphaAdapter } from "./alpha";
import { createAlphaAdapter } from "./alpha";
import type { ResolvedConfig } from "./config";
import { resolveConfig } from "./config";
import { NoSignerError, NotConnectedError } from "./errors";
import { normalizeOnChainOrderbook } from "./normalize";
import { LiveStateEngine } from "./state";
import type {
  AccountState,
  MarketState,
  OrderBookState,
  OrderState,
  PlaceOrderParams,
  PortfolioState,
  PositionState,
  TradeResult,
  VibeQuantConfig,
  VibeQuantEventMap,
} from "./types";
import { decimalPriceToMicro, decimalToMicro, microPriceToDecimal, microToDecimal } from "./units";

/** Approximate ALGO locked as minimum balance per on-chain order escrow. */
const ESCROW_MBR_ALGO = 0.957;

/**
 * The single entry point for the application.
 *
 * Combines Alpha Arcade REST, WebSocket streams, wallet data and trading into
 * one normalized interface. The frontend and LLM should never call Alpha
 * Arcade directly — only through this client.
 *
 * @example
 * ```ts
 * const client = new VibeQuantClient({ walletAddress, alphaArcadeApiKey });
 * await client.connect();
 * const markets = client.getMarkets();
 * const account = client.getAccount();
 * ```
 */
export class VibeQuantClient {
  private readonly config: ResolvedConfig;
  private readonly adapter: AlphaAdapter;
  private readonly engine: LiveStateEngine;
  private connected = false;

  constructor(config: VibeQuantConfig) {
    this.config = resolveConfig(config);
    this.adapter = createAlphaAdapter(this.config);
    this.engine = new LiveStateEngine(this.adapter, this.config);
  }

  /** Whether this client can sign and submit trades. */
  get canTrade(): boolean {
    return this.adapter.canTrade;
  }

  /** The Algorand address backing this client. */
  get walletAddress(): string {
    return this.adapter.activeAddress;
  }

  // --- lifecycle -----------------------------------------------------------

  /** Load the initial snapshot and start live streams. */
  async connect(): Promise<void> {
    if (this.connected) return;
    await this.engine.start();
    this.connected = true;
    this.engine.emitter.emit("connected", undefined);
  }

  /** Stop streams and polling. */
  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.engine.stop();
    this.connected = false;
    this.engine.emitter.emit("disconnected", undefined);
  }

  // --- events --------------------------------------------------------------

  on<K extends keyof VibeQuantEventMap>(
    event: K,
    handler: (payload: VibeQuantEventMap[K]) => void,
  ): () => void {
    return this.engine.emitter.on(event, handler);
  }

  off<K extends keyof VibeQuantEventMap>(
    event: K,
    handler: (payload: VibeQuantEventMap[K]) => void,
  ): void {
    this.engine.emitter.off(event, handler);
  }

  // --- read state (synchronous, from the live engine) ----------------------

  getMarkets(): MarketState[] {
    this.ensureConnected();
    return this.engine.getMarkets();
  }

  getMarket(idOrAppId: string | number): MarketState | undefined {
    this.ensureConnected();
    return this.engine.getMarket(idOrAppId);
  }

  getOrderBook(marketAppId: number): OrderBookState | undefined {
    this.ensureConnected();
    return this.engine.getOrderBook(marketAppId);
  }

  getPositions(): PositionState[] {
    this.ensureConnected();
    return this.engine.getPositions();
  }

  getOrders(): OrderState[] {
    this.ensureConnected();
    return this.engine.getOrders();
  }

  getAccount(): AccountState {
    this.ensureConnected();
    return this.engine.getAccount();
  }

  getPortfolio(): PortfolioState {
    this.ensureConnected();
    return this.engine.getPortfolio();
  }

  /** Start streaming the live orderbook for a market. */
  watchMarket(idOrAppId: string | number): void {
    this.ensureConnected();
    this.engine.watchMarket(idOrAppId);
  }

  // --- on-demand reads -----------------------------------------------------

  /** Fetch a fresh on-chain orderbook (does not require an API key). */
  async fetchOrderBook(marketAppId: number): Promise<OrderBookState> {
    const market = this.engine.getMarket(marketAppId);
    const ob = await this.adapter.alpha.getOrderbook(marketAppId);
    return normalizeOnChainOrderbook(market?.id ?? String(marketAppId), marketAppId, ob);
  }

  /** Force-refresh account, positions and orders from source. */
  async refresh(): Promise<void> {
    await Promise.allSettled([
      this.engine.refreshMarkets(),
      this.engine.refreshAccount(),
      this.engine.refreshPositions(),
      this.engine.refreshOrders(),
    ]);
  }

  /**
   * Pre-trade validation: confirms a signer exists, the wallet is opted into
   * USDC, and there's enough ALGO to cover the per-order escrow minimum balance
   * (~0.957 ALGO each). Returns a list of blocking issues (empty = ready).
   */
  async checkTradeReadiness(orderCount = 1): Promise<{ ready: boolean; issues: string[] }> {
    this.ensureConnected();
    const issues: string[] = [];

    if (!this.adapter.canTrade) {
      issues.push("No signer configured (read-only mode).");
    }

    try {
      const optedIn = await checkAssetOptIn(
        this.adapter.algod,
        this.adapter.activeAddress,
        this.config.usdcAssetId,
      );
      if (!optedIn) {
        issues.push(`Wallet is not opted into USDC (ASA ${this.config.usdcAssetId}).`);
      }
    } catch {
      // Network hiccup reading opt-in status — don't block on it.
    }

    const requiredAlgo = ESCROW_MBR_ALGO * Math.max(1, orderCount);
    const algoBalance = this.engine.getAccount().algoBalance;
    if (algoBalance < requiredAlgo) {
      issues.push(
        `Low ALGO balance (${algoBalance.toFixed(3)}): ~${requiredAlgo.toFixed(3)} needed ` +
          `for ${orderCount} order escrow(s).`,
      );
    }

    return { ready: issues.length === 0, issues };
  }

  // --- trading -------------------------------------------------------------

  async placeLimitOrder(params: PlaceOrderParams): Promise<TradeResult> {
    this.requireTrade();
    const result = await this.adapter.alpha.createLimitOrder({
      marketAppId: params.marketAppId,
      position: params.outcome === "YES" ? 1 : 0,
      price: decimalPriceToMicro(params.price),
      quantity: decimalToMicro(params.quantity),
      isBuying: params.isBuying,
      feeBase: params.feeBasePercent !== undefined ? decimalToMicro(params.feeBasePercent) : undefined,
    });
    await this.postTradeRefresh();
    return {
      success: true,
      escrowAppId: result.escrowAppId,
      txIds: result.txIds,
      confirmedRound: result.confirmedRound,
      matchedQuantity: result.matchedQuantity !== undefined ? microToDecimal(result.matchedQuantity) : undefined,
      matchedPrice: result.matchedPrice !== undefined ? microPriceToDecimal(result.matchedPrice) : undefined,
    };
  }

  async placeMarketOrder(params: PlaceOrderParams): Promise<TradeResult> {
    this.requireTrade();
    const result = await this.adapter.alpha.createMarketOrder({
      marketAppId: params.marketAppId,
      position: params.outcome === "YES" ? 1 : 0,
      price: decimalPriceToMicro(params.price),
      quantity: decimalToMicro(params.quantity),
      isBuying: params.isBuying,
      slippage: decimalToMicro(params.slippage ?? 0.02),
      feeBase: params.feeBasePercent !== undefined ? decimalToMicro(params.feeBasePercent) : undefined,
    });
    await this.postTradeRefresh();
    return {
      success: true,
      escrowAppId: result.escrowAppId,
      txIds: result.txIds,
      confirmedRound: result.confirmedRound,
      matchedQuantity: result.matchedQuantity !== undefined ? microToDecimal(result.matchedQuantity) : undefined,
      matchedPrice: result.matchedPrice !== undefined ? microPriceToDecimal(result.matchedPrice) : undefined,
    };
  }

  async cancelOrder(args: {
    marketAppId: number;
    escrowAppId: number;
    orderOwner?: string;
  }): Promise<TradeResult> {
    this.requireTrade();
    const result = await this.adapter.alpha.cancelOrder({
      marketAppId: args.marketAppId,
      escrowAppId: args.escrowAppId,
      orderOwner: args.orderOwner ?? this.adapter.activeAddress,
    });
    await this.postTradeRefresh();
    return { success: result.success, txIds: result.txIds, confirmedRound: result.confirmedRound };
  }

  async splitShares(marketAppId: number, amount: number): Promise<TradeResult> {
    this.requireTrade();
    const result = await this.adapter.alpha.splitShares({
      marketAppId,
      amount: decimalToMicro(amount),
    });
    await this.postTradeRefresh();
    return { success: result.success, txIds: result.txIds, confirmedRound: result.confirmedRound };
  }

  async mergeShares(marketAppId: number, amount: number): Promise<TradeResult> {
    this.requireTrade();
    const result = await this.adapter.alpha.mergeShares({
      marketAppId,
      amount: decimalToMicro(amount),
    });
    await this.postTradeRefresh();
    return { success: result.success, txIds: result.txIds, confirmedRound: result.confirmedRound };
  }

  async claim(marketAppId: number, assetId: number, amount?: number): Promise<TradeResult> {
    this.requireTrade();
    const result = await this.adapter.alpha.claim({
      marketAppId,
      assetId,
      amount: amount !== undefined ? decimalToMicro(amount) : undefined,
    });
    await this.postTradeRefresh();
    return { success: result.success, txIds: result.txIds, confirmedRound: result.confirmedRound };
  }

  // --- internals -----------------------------------------------------------

  private async postTradeRefresh(): Promise<void> {
    await Promise.allSettled([
      this.engine.refreshPositions(),
      this.engine.refreshOrders(),
      this.engine.refreshAccount(),
    ]);
  }

  private requireTrade(): void {
    this.ensureConnected();
    if (!this.adapter.canTrade) throw new NoSignerError();
  }

  private ensureConnected(): void {
    if (!this.connected) throw new NotConnectedError();
  }
}
