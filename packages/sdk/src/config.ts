import { VibeQuantError } from "./errors";
import type { VibeQuantConfig } from "./types";

/** Alpha Arcade mainnet defaults (see @alpha-arcade/sdk docs). */
export const MAINNET_MATCHER_APP_ID = 3078581851;
export const MAINNET_USDC_ASSET_ID = 31566704;
export const DEFAULT_ALGOD_SERVER = "https://mainnet-api.algonode.cloud";
export const DEFAULT_INDEXER_SERVER = "https://mainnet-idx.algonode.cloud";
export const DEFAULT_ALGOD_PORT = 443;
export const DEFAULT_WSS_URL = "wss://platform-wss.alphaarcade.com";

/** Fully resolved config with all defaults applied. */
export interface ResolvedConfig extends VibeQuantConfig {
  matcherAppId: number;
  usdcAssetId: number;
  algodServer: string;
  algodPort: number;
  algodToken: string;
  indexerServer: string;
  indexerPort: number;
  indexerToken: string;
  wsUrl: string;
  pollIntervalMs: number;
}

function num(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Catch common .env mistakes before connecting to Alpha Arcade. */
export function validateEnvConfig(config: VibeQuantConfig): void {
  const addr = config.walletAddress?.trim() ?? "";
  if (addr.startsWith("aa_pk_")) {
    throw new VibeQuantError(
      "ALPHA_WALLET_ADDRESS looks like an API key (aa_pk_…). " +
        "Put that in ALPHA_ARCADE_API_KEY instead. " +
        "ALPHA_WALLET_ADDRESS must be your Algorand address (58 characters).",
    );
  }
  if (addr && !/^[A-Z2-7]{58}$/.test(addr)) {
    throw new VibeQuantError(
      `ALPHA_WALLET_ADDRESS "${addr.slice(0, 12)}…" is not a valid Algorand address. ` +
        "Find it on https://alphaarcade.com under your account/wallet — not your MetaMask 0x address.",
    );
  }
  const mnemonic = config.mnemonic?.trim() ?? "";
  if (mnemonic.startsWith("0x")) {
    throw new VibeQuantError(
      "ALPHA_MNEMONIC must be a 25-word Algorand recovery phrase, not a MetaMask/EVM 0x private key. " +
        "Alpha Arcade trades on Algorand. Export your Algorand wallet phrase from Pera/Defly, " +
        "or leave ALPHA_MNEMONIC blank for read-only mode.",
    );
  }
}

export function configFromEnv(
  overrides: Partial<VibeQuantConfig> = {},
  env: Record<string, string | undefined> = process.env,
): VibeQuantConfig {
  const walletAddress = overrides.walletAddress ?? env.ALPHA_WALLET_ADDRESS ?? "";
  return {
    walletAddress,
    alphaArcadeApiKey: overrides.alphaArcadeApiKey ?? env.ALPHA_ARCADE_API_KEY,
    mnemonic: overrides.mnemonic ?? env.ALPHA_MNEMONIC,
    signer: overrides.signer,
    matcherAppId: overrides.matcherAppId ?? num(env.ALPHA_MATCHER_APP_ID),
    usdcAssetId: overrides.usdcAssetId ?? num(env.ALPHA_USDC_ASSET_ID),
    algodServer: overrides.algodServer ?? env.ALGOD_SERVER,
    algodPort: overrides.algodPort ?? num(env.ALGOD_PORT),
    algodToken: overrides.algodToken ?? env.ALGOD_TOKEN,
    indexerServer: overrides.indexerServer ?? env.INDEXER_SERVER,
    indexerPort: overrides.indexerPort ?? num(env.INDEXER_PORT),
    indexerToken: overrides.indexerToken ?? env.INDEXER_TOKEN,
    apiBaseUrl: overrides.apiBaseUrl ?? env.ALPHA_API_BASE_URL,
    wsUrl: overrides.wsUrl ?? env.ALPHA_WSS_URL,
    pollIntervalMs: overrides.pollIntervalMs ?? num(env.VIBEQUANT_POLL_INTERVAL_MS),
  };
}

export function resolveConfig(config: VibeQuantConfig): ResolvedConfig {
  validateEnvConfig(config);
  if (!config.walletAddress || config.walletAddress.trim() === "") {
    throw new VibeQuantError(
      "`walletAddress` is required. Set it directly or via ALPHA_WALLET_ADDRESS.",
    );
  }
  if (config.mnemonic && config.signer) {
    throw new VibeQuantError(
      "Provide either `mnemonic` or `signer`, not both.",
    );
  }
  return {
    ...config,
    matcherAppId: config.matcherAppId ?? MAINNET_MATCHER_APP_ID,
    usdcAssetId: config.usdcAssetId ?? MAINNET_USDC_ASSET_ID,
    algodServer: config.algodServer ?? DEFAULT_ALGOD_SERVER,
    algodPort: config.algodPort ?? DEFAULT_ALGOD_PORT,
    algodToken: config.algodToken ?? "",
    indexerServer: config.indexerServer ?? DEFAULT_INDEXER_SERVER,
    indexerPort: config.indexerPort ?? DEFAULT_ALGOD_PORT,
    indexerToken: config.indexerToken ?? "",
    wsUrl: config.wsUrl ?? DEFAULT_WSS_URL,
    pollIntervalMs: config.pollIntervalMs ?? 15_000,
  };
}
