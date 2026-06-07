import type { AlphaAdapter } from "./alpha";
import { fetchBalances } from "./alpha";
import type { ResolvedConfig } from "./config";
import { Emitter } from "./emitter";
import {
  expandMarket,
  normalizeOrder,
  normalizePosition,
  normalizeWsOrderbook,
} from "./normalize";
import type {
  AccountState,
  MarketState,
  OrderBookState,
  OrderState,
  PortfolioState,
  PositionState,
  VibeQuantEventMap,
} from "./types";

const DEBOUNCE_MS = 750;

/**
 * Maintains one normalized real-time view of Alpha Arcade.
 *
 *  - Loads an initial snapshot over REST.
 *  - Subscribes to WebSocket streams (reconnect / resubscribe handled by
 *    AlphaWebSocket internally).
 *  - Refreshes account/positions/orders on a poll interval and after trades.
 *  - Emits normalized change events.
 */
export class LiveStateEngine {
  readonly emitter = new Emitter<VibeQuantEventMap>();

  private markets = new Map<number, MarketState>();
  private slugToAppId = new Map<string, number>();
  private orderbooks = new Map<number, OrderBookState>();
  private positions = new Map<number, PositionState>();
  private orders = new Map<number, OrderState>();
  private account: AccountState;
  private portfolio: PortfolioState;

  private unsubscribers: Array<() => void> = [];
  private watchedMarkets = new Set<number>();
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private debouncers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<string>();
  private started = false;

  constructor(
    private readonly adapter: AlphaAdapter,
    private readonly config: ResolvedConfig,
  ) {
    const ts = Date.now();
    this.account = {
      walletAddress: adapter.activeAddress,
      usdcBalance: 0,
      algoBalance: 0,
      updatedAt: ts,
    };
    this.portfolio = {
      walletAddress: adapter.activeAddress,
      usdcBalance: 0,
      positionsValue: 0,
      totalValue: 0,
      exposureByMarket: {},
      updatedAt: ts,
    };
  }

  // --- lifecycle -----------------------------------------------------------

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    await Promise.allSettled([
      this.refreshMarkets(),
      this.refreshAccount(),
      this.refreshPositions(),
      this.refreshOrders(),
    ]);

    this.subscribeStreams();
    this.startPolling();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    for (const t of this.debouncers.values()) clearTimeout(t);
    this.debouncers.clear();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = undefined;
    this.adapter.ws.close();
  }

  // --- getters -------------------------------------------------------------

  getMarkets(): MarketState[] {
    return [...this.markets.values()];
  }

  getMarket(idOrAppId: string | number): MarketState | undefined {
    if (typeof idOrAppId === "number") return this.markets.get(idOrAppId);
    const bySlug = this.slugToAppId.get(idOrAppId);
    if (bySlug !== undefined) return this.markets.get(bySlug);
    for (const m of this.markets.values()) if (m.id === idOrAppId) return m;
    return undefined;
  }

  getOrderBook(marketAppId: number): OrderBookState | undefined {
    return this.orderbooks.get(marketAppId);
  }

  getPositions(): PositionState[] {
    return [...this.positions.values()];
  }

  getOrders(): OrderState[] {
    return [...this.orders.values()];
  }

  getAccount(): AccountState {
    return this.account;
  }

  getPortfolio(): PortfolioState {
    return this.portfolio;
  }

  // --- streaming -----------------------------------------------------------

  private subscribeStreams(): void {
    const { ws, activeAddress } = this.adapter;

    this.unsubscribers.push(
      ws.subscribeLiveMarkets(() => this.debounce("markets", () => this.refreshMarkets())),
    );
    this.unsubscribers.push(
      ws.subscribeWalletOrders(activeAddress, () =>
        this.debounce("orders", async () => {
          await this.refreshOrders();
          await this.refreshPositions();
          await this.refreshAccount();
        }),
      ),
    );
  }

  /** Subscribe to an orderbook stream for a market (idempotent). */
  watchMarket(idOrAppId: string | number): void {
    const market = this.getMarket(idOrAppId);
    if (!market || !market.slug) return;
    if (this.watchedMarkets.has(market.marketAppId)) return;
    this.watchedMarkets.add(market.marketAppId);

    const unsub = this.adapter.ws.subscribeOrderbook(market.slug, (event) => {
      for (const [appIdStr, app] of Object.entries(event.orderbook)) {
        const appId = Number(appIdStr);
        const book = normalizeWsOrderbook(event.marketId, appId, app);
        this.orderbooks.set(appId, book);
        this.emitter.emit("orderbook", book);
      }
      this.recomputePortfolio();
    });
    this.unsubscribers.push(unsub);
  }

  // --- refreshers ----------------------------------------------------------

  async refreshMarkets(): Promise<void> {
    await this.guard("refreshMarkets", async () => {
      const markets = await this.adapter.alpha.getLiveMarkets();
      this.markets.clear();
      this.slugToAppId.clear();
      for (const raw of markets) {
        // Multi-choice markets expand into one tradeable market per option.
        for (const m of expandMarket(raw)) {
          this.markets.set(m.marketAppId, m);
          if (m.slug) this.slugToAppId.set(m.slug, m.marketAppId);
        }
      }
      this.revaluePositions();
      this.emitter.emit("markets", this.getMarkets());
      this.recomputePortfolio();
    });
  }

  async refreshAccount(): Promise<void> {
    await this.guard("refreshAccount", async () => {
      const { usdcBalance, algoBalance } = await fetchBalances(
        this.adapter,
        this.adapter.activeAddress,
        this.config.usdcAssetId,
      );
      this.account = {
        walletAddress: this.adapter.activeAddress,
        usdcBalance,
        algoBalance,
        updatedAt: Date.now(),
      };
      this.emitter.emit("account", this.account);
      this.recomputePortfolio();
    });
  }

  async refreshPositions(): Promise<void> {
    await this.guard("refreshPositions", async () => {
      const raw = await this.adapter.alpha.getPositions(this.adapter.activeAddress);
      this.positions.clear();
      for (const p of raw) {
        if (p.yesBalance === 0 && p.noBalance === 0) continue;
        this.positions.set(p.marketAppId, normalizePosition(p));
      }
      this.revaluePositions();
      this.emitter.emit("positions", this.getPositions());
      this.recomputePortfolio();
    });
  }

  async refreshOrders(): Promise<void> {
    // Wallet-wide order lookup requires an API key. Without one, open orders
    // can only be read per-market on-chain (done lazily by callers).
    if (!this.adapter.apiKey) return;
    await this.guard("refreshOrders", async () => {
      const raw = await this.adapter.alpha.getWalletOrdersFromApi(this.adapter.activeAddress);
      this.orders.clear();
      for (const o of raw) this.orders.set(o.escrowAppId, normalizeOrder(o));
      this.emitter.emit("orders", this.getOrders());
    });
  }

  // --- valuation -----------------------------------------------------------

  private revaluePositions(): void {
    for (const [appId, pos] of this.positions) {
      const market = this.markets.get(appId);
      const yesPrice = market?.yesProbability;
      const noPrice = market?.noProbability;
      const yesValue = yesPrice !== undefined ? pos.yesShares * yesPrice : undefined;
      const noValue = noPrice !== undefined ? pos.noShares * noPrice : undefined;
      const value =
        yesValue === undefined && noValue === undefined
          ? undefined
          : (yesValue ?? 0) + (noValue ?? 0);
      this.positions.set(appId, {
        ...pos,
        marketId: market?.id ?? pos.marketId,
        title: market?.title ?? pos.title,
        yesValue,
        noValue,
        value,
      });
    }
  }

  private recomputePortfolio(): void {
    let positionsValue = 0;
    const exposureByMarket: Record<number, number> = {};
    for (const pos of this.positions.values()) {
      if (pos.value !== undefined) {
        positionsValue += pos.value;
        exposureByMarket[pos.marketAppId] = pos.value;
      }
    }
    this.portfolio = {
      walletAddress: this.adapter.activeAddress,
      usdcBalance: this.account.usdcBalance,
      positionsValue,
      totalValue: this.account.usdcBalance + positionsValue,
      exposureByMarket,
      updatedAt: Date.now(),
    };
    this.emitter.emit("portfolio", this.portfolio);
  }

  // --- helpers -------------------------------------------------------------

  private startPolling(): void {
    if (this.config.pollIntervalMs <= 0) return;
    this.pollTimer = setInterval(() => {
      void this.refreshAccount();
      void this.refreshPositions();
      void this.refreshOrders();
    }, this.config.pollIntervalMs);
  }

  private debounce(key: string, fn: () => void | Promise<void>): void {
    const existing = this.debouncers.get(key);
    if (existing) clearTimeout(existing);
    this.debouncers.set(
      key,
      setTimeout(() => {
        this.debouncers.delete(key);
        void fn();
      }, DEBOUNCE_MS),
    );
  }

  private async guard(key: string, fn: () => Promise<void>): Promise<void> {
    if (this.inFlight.has(key)) return;
    this.inFlight.add(key);
    try {
      await fn();
    } catch (error) {
      this.emitter.emit(
        "error",
        error instanceof Error ? error : new Error(`${key} failed: ${String(error)}`),
      );
    } finally {
      this.inFlight.delete(key);
    }
  }
}
