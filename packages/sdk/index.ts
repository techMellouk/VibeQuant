/**
 * @vibequant/sdk
 *
 * Unified Alpha Arcade SDK. Combines REST, WebSocket streams, wallet data and
 * trading into one normalized real-time interface, behind {@link VibeQuantClient}.
 */

export { VibeQuantClient } from "./src/client";

export { LiveStateEngine } from "./src/state";

export { configFromEnv, resolveConfig } from "./src/config";
export type { ResolvedConfig } from "./src/config";
export {
  MAINNET_MATCHER_APP_ID,
  MAINNET_USDC_ASSET_ID,
  DEFAULT_ALGOD_SERVER,
  DEFAULT_INDEXER_SERVER,
  DEFAULT_WSS_URL,
} from "./src/config";

export { VibeQuantError, NoSignerError, NotConnectedError } from "./src/errors";

export {
  microToDecimal,
  decimalToMicro,
  microPriceToDecimal,
  decimalPriceToMicro,
} from "./src/units";

export type {
  VibeQuantConfig,
  VibeQuantEvent,
  VibeQuantEventMap,
  MarketState,
  OrderBookState,
  OrderBookSideState,
  OrderBookLevel,
  AccountState,
  PositionState,
  OrderState,
  PortfolioState,
  TradeResult,
  PlaceOrderParams,
  Outcome,
  OrderSide,
  OrderType,
  OrderStatus,
} from "./src/types";
