/**
 * Market Discovery Engine (CURSOR.md §3).
 * Converts a broad thesis into relevant Alpha Arcade markets.
 */

import type { MarketState } from "@vibequant/sdk";
import { hasLLM, chatJSON } from "./llm";
import { cleanDisplayText } from "./display";
import { loadMarkets } from "./markets";
import { logActivity } from "./activity";
import type { DiscoveredMarket, DiscoveryResult } from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "will", "is", "are", "be", "to", "of", "in", "on", "and",
  "or", "i", "think", "believe", "that", "this", "it", "for", "with", "about",
  "going", "happen", "next", "before", "after", "than", "more", "less",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function dedupeDiscovered(markets: DiscoveredMarket[]): DiscoveredMarket[] {
  const seen = new Set<string>();
  return markets.filter((m) => {
    const key = m.marketId || String(m.marketAppId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function heuristicDiscovery(thesis: string, markets: MarketState[]): DiscoveryResult {
  const terms = tokenize(thesis);
  const scored = markets
    .map((m) => {
      const haystack = `${m.title} ${m.categories.join(" ")}`.toLowerCase();
      let hits = 0;
      for (const t of terms) if (haystack.includes(t)) hits += 1;
      const relevance = terms.length > 0 ? hits / terms.length : 0;
      return { market: m, relevance };
    })
    .filter((s) => s.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);

  const markets_: DiscoveredMarket[] = scored.map(({ market, relevance }) => ({
    marketId: market.id,
    marketAppId: market.marketAppId,
    question: cleanDisplayText(market.title),
    slug: market.slug,
    relevance: Math.min(1, Math.round(relevance * 100) / 100),
    relationship: relevance >= 0.5 ? "direct" : "indirect",
    reason: "Keyword overlap with your thesis.",
    yesProbability: market.yesProbability,
    noProbability: market.noProbability,
    volume: market.volume,
  }));

  return {
    thesis,
    entities: terms.slice(0, 5),
    themes: [...new Set(scored.flatMap((s) => s.market.categories))].slice(0, 5),
    markets: dedupeDiscovered(markets_),
  };
}

interface LLMDiscovery {
  entities: string[];
  themes: string[];
  selections: Array<{
    marketAppId: number;
    relevance: number;
    relationship: "direct" | "indirect";
    reason: string;
  }>;
}

export async function discoverMarkets(thesis: string): Promise<DiscoveryResult> {
  const { markets } = await loadMarkets();

  let result: DiscoveryResult;

  if (hasLLM()) {
    const candidates = markets.map((m) => ({
      marketAppId: m.marketAppId,
      title: cleanDisplayText(m.title),
      categories: m.categories,
      yesProbability: m.yesProbability,
      volumeUsd: m.volume,
    }));

    try {
      const llm = await chatJSON<LLMDiscovery>({
        system:
          "You are a prediction-market analyst. Given a user's thesis and a list of available markets, " +
          "extract the key entities and themes, then select the markets that express the thesis either " +
          "directly or indirectly. Consider second-order effects (e.g. succession, related parties). " +
          'Respond ONLY with JSON: {"entities": string[], "themes": string[], "selections": ' +
          '[{"marketAppId": number, "relevance": number (0..1), "relationship": "direct"|"indirect", "reason": string}]}. ' +
          "Pick at most 5 markets, highest relevance first. All candidates already meet a minimum volume threshold.",
        user: JSON.stringify({ thesis, markets: candidates }),
        temperature: 0.2,
      });

      const byId = new Map(markets.map((m) => [m.marketAppId, m]));
      const selected: DiscoveredMarket[] = (llm.selections ?? [])
        .map((s): DiscoveredMarket | null => {
          const m = byId.get(s.marketAppId);
          if (!m) return null;
          return {
            marketId: m.id,
            marketAppId: m.marketAppId,
            question: cleanDisplayText(m.title),
            slug: m.slug,
            relevance: Math.max(0, Math.min(1, s.relevance ?? 0.5)),
            relationship: s.relationship === "direct" ? "direct" : "indirect",
            reason: s.reason ?? "Relevant to your thesis.",
            yesProbability: m.yesProbability,
            noProbability: m.noProbability,
            volume: m.volume,
          };
        })
        .filter((x): x is DiscoveredMarket => x !== null)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 5);

      result = {
        thesis,
        entities: llm.entities ?? [],
        themes: llm.themes ?? [],
        markets:
          selected.length > 0
            ? dedupeDiscovered(selected)
            : heuristicDiscovery(thesis, markets).markets,
      };
    } catch (error) {
      console.error("[discovery] LLM failed, using heuristic:", error);
      result = heuristicDiscovery(thesis, markets);
    }
  } else {
    result = heuristicDiscovery(thesis, markets);
  }

  logActivity({ type: "thesis_submitted", description: `Thesis: "${thesis}"` });
  for (const m of result.markets) {
    logActivity({
      type: "market_discovered",
      description: `Discovered market (${m.relationship}, relevance ${m.relevance})`,
      marketQuestion: m.question,
    });
  }

  return result;
}
