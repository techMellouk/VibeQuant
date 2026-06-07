/**
 * Real x402 payment client (server-side, Node).
 *
 * Wraps `fetch` so that a `402 Payment Required` response is automatically
 * settled on Algorand and the request retried with payment proof, using the
 * @x402-avm/* libraries and an algosdk signer derived from ALPHA_MNEMONIC.
 *
 * This module must only run server-side (it holds the signing key).
 */

import algosdk from "algosdk";
import { x402Client, wrapFetchWithPayment, type PaymentPolicy } from "@x402-avm/fetch";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";
import type { ClientAvmSigner } from "@x402-avm/avm";

export interface PaidFetch {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** USDC amount of the most recent payment, if one occurred. */
  getLastPaidUsdc: () => number | undefined;
}

/**
 * Build a payment-capable fetch from a 25-word mnemonic. A `X402_MAX_USDC`
 * spend cap (default $1) is enforced as a payment policy.
 */
export function createPaidFetch(mnemonic: string): PaidFetch {
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const address = account.addr.toString();

  const signer: ClientAvmSigner = {
    address,
    signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) =>
      txns.map((txn, i) => {
        if (indexesToSign && !indexesToSign.includes(i)) return null;
        const decoded = algosdk.decodeUnsignedTransaction(txn);
        return algosdk.signTransaction(decoded, account.sk).blob;
      }),
  };

  const client = new x402Client();
  registerExactAvmScheme(client, { signer });

  const maxUsdc = Number(process.env.X402_MAX_USDC ?? "1");
  const maxMicro = BigInt(Math.round(maxUsdc * 1_000_000));
  const capPolicy: PaymentPolicy = (_version, reqs) =>
    reqs.filter((r) => BigInt((r as { amount?: string }).amount ?? "0") <= maxMicro);
  client.registerPolicy(capPolicy);

  let lastPaidUsdc: number | undefined;
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    const raw = (selectedRequirements as { amount?: string | number }).amount;
    lastPaidUsdc = raw !== undefined ? Number(raw) / 1_000_000 : undefined;
  });

  return {
    fetch: wrapFetchWithPayment(fetch, client),
    getLastPaidUsdc: () => lastPaidUsdc,
  };
}
