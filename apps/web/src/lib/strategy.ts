/**
 * LLM Strategy Engine (CURSOR.md §4).
 * Turns a thesis + selected markets + live data into a structured strategy.
 */

import { cleanDisplayText } from "./display";
import { hasLLM, chatJSON } from "./llm";
import { getClient } from "./sdk";
import { maybePurchaseSignal } from "./x402";
import { logActivity } from "./activity";
import { DEMO_USDC_BALANCE } from "./demo";
import type { DiscoveredMarket, ProposedTrade, Strategy, StrategySignal } from "./types";

const DEFAULT_BUDGET = 20;

export interface GenerateStrategyInput {
  thesis: string;
  markets: DiscoveredMarket[];
  /** Free-text refinement instruction (for follow-up turns). */
  instructions?: string;
  /** Prior strategy being refined. */
  prior?: Strategy;
  /** Hard capital cap in USDC. */
  budget?: number;
}

function newId(): string {
  return `str_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;
}

async function resolveBudget(requested?: number): Promise<number> {
  let balance = DEMO_USDC_BALANCE;
  const client = await getClient();
  if (client) {
    try {
      balance = client.getAccount().usdcBalance;
    } catch {
      /* keep demo balance */
    }
  }
  const cap = requested ?? DEFAULT_BUDGET;
  return Math.max(0, Math.min(cap, balance));
}

function clampTrades(trades: ProposedTrade[], budget: number, markets: DiscoveredMarket[]): ProposedTrade[] {
  const byId = new Map(markets.map((m) => [m.marketAppId, m]));
  const valid = trades.filter((t) => byId.has(t.marketAppId) && t.amount > 0);
  const total = valid.reduce((s, t) => s + t.amount, 0);
  const scale = total > budget && total > 0 ? budget / total : 1;
  return valid.map((t) => {
    const m = byId.get(t.marketAppId)!;
    return {
      ...t,
      marketId: m.marketId,
      marketQuestion: m.question,
      amount: Math.round(t.amount * scale * 100) / 100,
      outcome: t.outcome === "NO" ? "NO" : "YES",
      orderType: t.orderType === "LIMIT" ? "LIMIT" : "MARKET",
    };
  });
}

function heuristicStrategy(input: GenerateStrategyInput, budget: number, signals: StrategySignal[]): Strategy {
  const direct = input.markets.filter((m) => m.relationship === "direct");
  const chosen = (direct.length > 0 ? direct : input.markets).slice(0, 3);
  const weightTotal = chosen.reduce((s, m) => s + m.relevance, 0) || 1;

  const trades: ProposedTrade[] = chosen.map((m) => {
    const amount = Math.round(((m.relevance / weightTotal) * budget) * 100) / 100;
    // Default to the outcome the thesis affirms (YES); the LLM path refines this.
    return {
      marketId: m.marketId,
      marketAppId: m.marketAppId,
      marketQuestion: m.question,
      outcome: "YES",
      orderType: "MARKET",
      amount,
      reasoning: `Allocated by relevance (${m.relevance}). ${m.reason}`,
    };
  });

  const totalCapital = trades.reduce((s, t) => s + t.amount, 0);
  return {
    id: newId(),
    thesis: input.thesis,
    explanation:
      "Heuristic allocation across the most relevant markets, weighted by relevance. " +
      "Connect an LLM (set LLM_API_KEY) for tailored reasoning and outcome selection.",
    trades,
    totalCapital: Math.round(totalCapital * 100) / 100,
    maximumLoss: Math.round(totalCapital * 100) / 100,
    confidence: 0.4,
    risks: [
      "Outcome side chosen heuristically (defaults to YES).",
      "No live order-book or liquidity check in heuristic mode.",
    ],
    signals,
    createdAt: Date.now(),
  };
}

interface LLMStrategy {
  explanation: string;
  confidence: number;
  risks: string[];
  trades: Array<{
    marketAppId: number;
    outcome: "YES" | "NO";
    orderType: "MARKET" | "LIMIT";
    amount: number;
    limitPrice?: number;
    reasoning: string;
  }>;
}

export async function generateStrategy(input: GenerateStrategyInput): Promise<Strategy> {
  const budget = await resolveBudget(input.budget);
  const signal = await maybePurchaseSignal(input.thesis);
  const signals = signal ? [signal] : [];

  let strategy: Strategy;

  if (hasLLM() && input.markets.length > 0) {
    try {
      const llm = await chatJSON<LLMStrategy>({
        system:
          "You are a disciplined prediction-market strategist on Alpha Arcade. Given a thesis, a set of " +
          "candidate markets (with YES/NO probabilities), a capital budget in USDC, and optional external " +
          "signals, design a tailored strategy. Choose YES or NO per market to express the thesis, size " +
          "positions within the budget, and avoid illiquid or irrelevant markets. The total allocated " +
          "capital MUST NOT exceed the budget. Respond ONLY with JSON: " +
          '{"explanation": string, "confidence": number (0..1), "risks": string[], "trades": ' +
          '[{"marketAppId": number, "outcome": "YES"|"NO", "orderType": "MARKET"|"LIMIT", "amount": number (USDC), ' +
          '"limitPrice"?: number (0..1), "reasoning": string}]}.',
        user: JSON.stringify({
          thesis: input.thesis,
          budgetUsdc: budget,
          markets: input.markets.map((m) => ({
            marketAppId: m.marketAppId,
            question: m.question,
            relationship: m.relationship,
            relevance: m.relevance,
            yesProbability: m.yesProbability,
            noProbability: m.noProbability,
            volume: m.volume,
          })),
          signals,
          instructions: input.instructions,
          priorStrategy: input.prior,
        }),
        temperature: 0.3,
      });

      const trades = clampTrades(
        (llm.trades ?? []).map((t) => ({
          marketId: "",
          marketAppId: t.marketAppId,
          marketQuestion: "",
          outcome: t.outcome,
          orderType: t.orderType,
          amount: t.amount,
          limitPrice: t.limitPrice,
          reasoning: t.reasoning,
        })),
        budget,
        input.markets,
      );

      const totalCapital = Math.round(trades.reduce((s, t) => s + t.amount, 0) * 100) / 100;
      strategy = {
        id: newId(),
        thesis: input.thesis,
        explanation: llm.explanation ?? "Strategy generated.",
        trades,
        totalCapital,
        maximumLoss: totalCapital,
        confidence: Math.max(0, Math.min(1, llm.confidence ?? 0.5)),
        risks: llm.risks ?? [],
        signals,
        createdAt: Date.now(),
      };
    } catch (error) {
      console.error("[strategy] LLM failed, using heuristic:", error);
      strategy = heuristicStrategy(input, budget, signals);
    }
  } else {
    strategy = heuristicStrategy(input, budget, signals);
  }

  logActivity({
    type: input.prior ? "strategy_modified" : "strategy_generated",
    description: input.prior
      ? `Strategy refined${input.instructions ? `: "${input.instructions}"` : ""}`
      : `Strategy generated for "${input.thesis}" (${strategy.trades.length} trades, ${strategy.totalCapital} USDC)`,
  });

  return {
    ...strategy,
    explanation: cleanDisplayText(strategy.explanation),
    risks: strategy.risks.map(cleanDisplayText),
    trades: strategy.trades.map((t) => ({
      ...t,
      marketQuestion: cleanDisplayText(t.marketQuestion),
      reasoning: t.reasoning ? cleanDisplayText(t.reasoning) : t.reasoning,
    })),
    signals: strategy.signals?.map((s) => ({
      ...s,
      summary: cleanDisplayText(s.summary),
    })),
  };
}
