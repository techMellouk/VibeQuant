/**
 * Trade Execution Engine (CURSOR.md §6).
 * Converts an approved strategy into Alpha Arcade orders via the SDK.
 *
 * No trade executes before explicit user approval — approval happens in the UI,
 * and this runs only when the user hits the /api/execute route.
 */

import { getClient } from "./sdk";
import { logActivity } from "./activity";
import type { ExecutionLeg, ExecutionReport, Strategy } from "./types";
import type { VibeQuantClient } from "@vibequant/sdk";

/** When true (default), never submit on-chain orders — simulate fills instead. Set to `false` to allow real trades (requires ALPHA_MNEMONIC). */
export function shouldSimulateTrades(canTrade: boolean): boolean {
  const flag = process.env.SIMULATE_TRADES?.trim().toLowerCase();
  if (flag === "false") return false;
  if (flag === "true") return true;
  // Default: simulate whenever we cannot sign (read-only / platform wallet).
  return !canTrade;
}

function simulateFill(
  trade: Strategy["trades"][number],
  client: VibeQuantClient | null,
): ExecutionLeg {
  const market = client?.getMarket(trade.marketAppId);
  const sideProb =
    trade.outcome === "YES" ? market?.yesProbability : market?.noProbability;
  const fillPrice = trade.limitPrice ?? sideProb ?? 0.5;
  const filledQuantity = fillPrice > 0 ? trade.amount / fillPrice : 0;

  const message = client
    ? "Simulated fill using live market prices. No order was submitted."
    : "Simulated fill (demo mode, no wallet configured).";

  return {
    marketQuestion: trade.marketQuestion,
    outcome: trade.outcome,
    amount: trade.amount,
    status: "filled",
    txIds: [],
    filledQuantity: Math.round(filledQuantity * 100) / 100,
    fillPrice: Math.round(fillPrice * 1000) / 1000,
    message,
  };
}

export async function executeStrategy(strategy: Strategy): Promise<ExecutionReport> {
  logActivity({
    type: "strategy_approved",
    description: `Strategy approved (${strategy.trades.length} trades, ${strategy.totalCapital} USDC)`,
  });

  const client = await getClient();
  const results: ExecutionLeg[] = [];
  const simulate = shouldSimulateTrades(client?.canTrade ?? false);

  // Preflight only when we will submit real orders.
  if (client && client.canTrade && !simulate) {
    const readiness = await client.checkTradeReadiness(strategy.trades.length);
    if (!readiness.ready) {
      const message = `Trade preflight failed: ${readiness.issues.join(" ")}`;
      logActivity({ type: "error", description: message, status: "blocked" });
      return {
        strategyId: strategy.id,
        results: strategy.trades.map((t) => ({
          marketQuestion: t.marketQuestion,
          outcome: t.outcome,
          amount: t.amount,
          status: "skipped" as const,
          txIds: [],
          message,
        })),
        allFilled: false,
      };
    }
  }

  for (const trade of strategy.trades) {
    logActivity({
      type: "trade_submitted",
      description: simulate
        ? `Simulating ${trade.outcome} ${trade.orderType} for ${trade.amount} USDC`
        : `Submitting ${trade.outcome} ${trade.orderType} for ${trade.amount} USDC`,
      marketQuestion: trade.marketQuestion,
    });

    if (simulate || !client) {
      const leg = simulateFill(trade, client);
      results.push(leg);
      logActivity({
        type: "trade_filled",
        description: `Simulated fill for ${trade.outcome}${client ? " (live prices)" : " (demo)"}`,
        marketQuestion: trade.marketQuestion,
        status: "filled",
      });
      continue;
    }

    try {
      const market = client.getMarket(trade.marketAppId);
      const sideProb = trade.outcome === "YES" ? market?.yesProbability : market?.noProbability;
      const price = trade.limitPrice ?? sideProb ?? 0.5;
      const quantity = price > 0 ? trade.amount / price : 0;

      if (quantity <= 0) {
        results.push({
          marketQuestion: trade.marketQuestion,
          outcome: trade.outcome,
          amount: trade.amount,
          status: "failed",
          txIds: [],
          message: "Could not determine a valid price/quantity.",
        });
        continue;
      }

      const result =
        trade.orderType === "LIMIT" && trade.limitPrice
          ? await client.placeLimitOrder({
              marketAppId: trade.marketAppId,
              outcome: trade.outcome,
              isBuying: true,
              price: trade.limitPrice,
              quantity,
            })
          : await client.placeMarketOrder({
              marketAppId: trade.marketAppId,
              outcome: trade.outcome,
              isBuying: true,
              price,
              quantity,
              slippage: 0.03,
            });

      const filled = result.matchedQuantity ?? 0;
      const status: ExecutionLeg["status"] =
        filled <= 0 ? "partial" : filled < quantity ? "partial" : "filled";

      results.push({
        marketQuestion: trade.marketQuestion,
        outcome: trade.outcome,
        amount: trade.amount,
        status,
        txIds: result.txIds,
        filledQuantity: result.matchedQuantity,
        fillPrice: result.matchedPrice,
      });

      logActivity({
        type: "trade_filled",
        description: `${status === "filled" ? "Filled" : "Submitted"} ${trade.outcome} order`,
        marketQuestion: trade.marketQuestion,
        reference: result.txIds[0],
        status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        marketQuestion: trade.marketQuestion,
        outcome: trade.outcome,
        amount: trade.amount,
        status: "failed",
        txIds: [],
        message,
      });
      logActivity({
        type: "error",
        description: `Trade failed: ${message}`,
        marketQuestion: trade.marketQuestion,
        status: "failed",
      });
    }
  }

  logActivity({ type: "position_updated", description: "Positions refreshed after execution." });

  return {
    strategyId: strategy.id,
    results,
    allFilled: results.length > 0 && results.every((r) => r.status === "filled"),
  };
}
