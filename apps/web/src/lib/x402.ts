/**
 * x402 paid-signal client (see CURSOR.md §7).
 *
 * Exposes an optional "signal provider" interface (the day-one seam noted in
 * the spec) so paid external data can be folded into strategy generation.
 *
 * - If `X402_SIGNAL_URL` is set, it performs a real fetch and pays via x402 on
 *   a 402 response (payment handshake left as a TODO for the live integration).
 * - If `X402_DEMO=true`, it returns a simulated signal so the full flow can be
 *   demonstrated without a paid endpoint.
 * - Otherwise it returns null and strategy generation proceeds without signals.
 */

import { logActivity } from "./activity";
import type { StrategySignal } from "./types";

export function x402Enabled(): boolean {
  return Boolean(process.env.X402_SIGNAL_URL?.trim()) || process.env.X402_DEMO === "true";
}

export async function maybePurchaseSignal(thesis: string): Promise<StrategySignal | null> {
  if (!x402Enabled()) return null;

  if (process.env.X402_DEMO === "true" && !process.env.X402_SIGNAL_URL) {
    const signal: StrategySignal = {
      provider: "demo-sentiment",
      summary: `Simulated sentiment signal: market chatter leans slightly toward "${thesis.slice(0, 60)}".`,
      costUsdc: 0.02,
    };
    logActivity({
      type: "signal_purchased",
      description: `Purchased ${signal.provider} signal via x402 (demo)`,
      costUsdc: signal.costUsdc,
      status: "ok",
    });
    return signal;
  }

  const url = process.env.X402_SIGNAL_URL;
  if (!url) return null;

  const mnemonic = process.env.ALPHA_MNEMONIC?.trim();
  if (!mnemonic) {
    console.warn("[x402] X402_SIGNAL_URL is set but ALPHA_MNEMONIC is missing — cannot pay.");
    return null;
  }

  try {
    // Lazy-load so the signing libs are only pulled in when actually paying.
    const { createPaidFetch } = await import("./x402-client");
    const paid = createPaidFetch(mnemonic);

    // wrapFetchWithPayment transparently settles a 402 and retries.
    const res = await paid.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thesis }),
    });
    if (!res.ok) {
      console.warn(`[x402] signal request failed: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { summary?: string; cost?: number };
    const cost = data.cost ?? paid.getLastPaidUsdc() ?? 0;
    const receipt = res.headers.get("PAYMENT-RESPONSE") ?? undefined;
    const signal: StrategySignal = {
      provider: new URL(url).hostname,
      summary: data.summary ?? "External signal received.",
      costUsdc: cost,
    };
    logActivity({
      type: "signal_purchased",
      description: `Paid for signal from ${signal.provider} via x402`,
      costUsdc: cost,
      reference: receipt?.slice(0, 16),
      status: "ok",
    });
    return signal;
  } catch (error) {
    console.error("[x402] paid fetch failed:", error);
    return null;
  }
}
