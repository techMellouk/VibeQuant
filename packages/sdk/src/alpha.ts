import algosdk from "algosdk";
import type { TransactionSigner } from "algosdk";
import { AlphaClient, AlphaWebSocket } from "@alpha-arcade/sdk";

import { VibeQuantError } from "./errors";
import type { ResolvedConfig } from "./config";
import { microToDecimal } from "./units";

/** Everything the live-state engine needs to talk to Alpha Arcade. */
export interface AlphaAdapter {
  alpha: AlphaClient;
  ws: AlphaWebSocket;
  algod: algosdk.Algodv2;
  indexer: algosdk.Indexer;
  activeAddress: string;
  /** Whether a real signer is available (i.e. trading is enabled). */
  canTrade: boolean;
  apiKey: string | undefined;
}

/**
 * A signer used in read-only mode. It throws if any transaction is actually
 * submitted, so reads keep working while trades fail loudly.
 */
const readOnlySigner: TransactionSigner = async () => {
  throw new VibeQuantError(
    "No signer configured — this client is read-only. Provide `signer` or `mnemonic`.",
  );
};

export function createAlphaAdapter(config: ResolvedConfig): AlphaAdapter {
  const algod = new algosdk.Algodv2(config.algodToken, config.algodServer, config.algodPort);
  const indexer = new algosdk.Indexer(
    config.indexerToken,
    config.indexerServer,
    config.indexerPort,
  );

  let signer: TransactionSigner = readOnlySigner;
  let activeAddress = config.walletAddress;
  let canTrade = false;

  if (config.signer) {
    signer = config.signer;
    canTrade = true;
  } else if (config.mnemonic) {
    const account = algosdk.mnemonicToSecretKey(config.mnemonic);
    const derived = account.addr.toString();
    if (config.walletAddress && config.walletAddress !== derived) {
      throw new VibeQuantError(
        `walletAddress (${config.walletAddress}) does not match the address derived ` +
          `from the provided mnemonic (${derived}).`,
      );
    }
    signer = algosdk.makeBasicAccountTransactionSigner(account);
    activeAddress = derived;
    canTrade = true;
  }

  const alpha = new AlphaClient({
    algodClient: algod,
    indexerClient: indexer,
    signer,
    activeAddress,
    matcherAppId: config.matcherAppId,
    usdcAssetId: config.usdcAssetId,
    apiKey: config.alphaArcadeApiKey,
    apiBaseUrl: config.apiBaseUrl,
  });

  const ws = new AlphaWebSocket({ url: config.wsUrl });

  return { alpha, ws, algod, indexer, activeAddress, canTrade, apiKey: config.alphaArcadeApiKey };
}

/** Minimal shape of the algod account-information response we rely on. */
interface RawAccountInfo {
  amount?: number | bigint;
  assets?: Array<{ amount?: number | bigint; assetId?: number | bigint; "asset-id"?: number | bigint }>;
}

/** Reads spendable USDC and native ALGO balances for an address. */
export async function fetchBalances(
  adapter: AlphaAdapter,
  address: string,
  usdcAssetId: number,
): Promise<{ usdcBalance: number; algoBalance: number }> {
  const info = (await adapter.algod.accountInformation(address).do()) as unknown as RawAccountInfo;
  const algoBalance = microToDecimal(info.amount ?? 0);

  let usdcMicro: number | bigint = 0;
  for (const asset of info.assets ?? []) {
    const id = Number(asset.assetId ?? asset["asset-id"] ?? -1);
    if (id === usdcAssetId) {
      usdcMicro = asset.amount ?? 0;
      break;
    }
  }
  return { usdcBalance: microToDecimal(usdcMicro), algoBalance };
}
