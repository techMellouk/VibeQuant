/** Builds the dashboard snapshot from the SDK, or demo data in demo mode. */

import { getClient } from "./sdk";
import { DEMO_ALGO_BALANCE, DEMO_MARKETS, DEMO_USDC_BALANCE, DEMO_WALLET } from "./demo";
import type { OrderRow, PortfolioSnapshot, PositionRow } from "./types";

function demoSnapshot(): PortfolioSnapshot {
  const market = DEMO_MARKETS[0]!;
  const shares = 18;
  const currentPrice = market.yesProbability ?? 0.5;
  const entryPrice = 0.8;
  const value = shares * currentPrice;
  const positions: PositionRow[] = [
    {
      marketQuestion: market.title,
      outcome: "YES",
      shares,
      entryPrice,
      currentPrice,
      value: Math.round(value * 100) / 100,
      unrealizedPnl: Math.round(shares * (currentPrice - entryPrice) * 100) / 100,
    },
  ];
  const positionsValue = positions.reduce((s, p) => s + (p.value ?? 0), 0);
  return {
    connected: false,
    demo: true,
    canTrade: false,
    walletAddress: DEMO_WALLET,
    account: { usdcBalance: DEMO_USDC_BALANCE, algoBalance: DEMO_ALGO_BALANCE },
    portfolio: {
      positionsValue: Math.round(positionsValue * 100) / 100,
      totalValue: Math.round((DEMO_USDC_BALANCE + positionsValue) * 100) / 100,
    },
    positions,
    orders: [],
  };
}

export async function buildPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const client = await getClient();
  if (!client) return demoSnapshot();

  try {
    const account = client.getAccount();
    const portfolio = client.getPortfolio();
    const marketTitle = (appId: number) => client.getMarket(appId)?.title ?? `Market ${appId}`;

    const positions: PositionRow[] = [];
    for (const p of client.getPositions()) {
      const market = client.getMarket(p.marketAppId);
      if (p.yesShares > 0) {
        const currentPrice = market?.yesProbability;
        positions.push({
          marketQuestion: p.title ?? marketTitle(p.marketAppId),
          outcome: "YES",
          shares: p.yesShares,
          currentPrice,
          value: p.yesValue,
        });
      }
      if (p.noShares > 0) {
        const currentPrice = market?.noProbability;
        positions.push({
          marketQuestion: p.title ?? marketTitle(p.marketAppId),
          outcome: "NO",
          shares: p.noShares,
          currentPrice,
          value: p.noValue,
        });
      }
    }

    const orders: OrderRow[] = client.getOrders().map((o) => ({
      marketQuestion: marketTitle(o.marketAppId),
      outcome: o.outcome,
      side: o.side,
      price: o.price,
      quantity: o.quantity,
      filled: o.quantityFilled,
      status: o.status,
    }));

    return {
      connected: true,
      demo: false,
      canTrade: client.canTrade,
      walletAddress: client.walletAddress,
      account: { usdcBalance: account.usdcBalance, algoBalance: account.algoBalance },
      portfolio: {
        positionsValue: Math.round(portfolio.positionsValue * 100) / 100,
        totalValue: Math.round(portfolio.totalValue * 100) / 100,
      },
      positions,
      orders,
    };
  } catch (error) {
    console.error("[portfolio] snapshot failed, using demo:", error);
    return demoSnapshot();
  }
}
