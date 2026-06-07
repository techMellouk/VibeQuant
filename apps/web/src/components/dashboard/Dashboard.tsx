"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  TrendingUp,
  Layers,
  ScrollText,
  RefreshCw,
  CircleDollarSign,
} from "lucide-react";
import { cleanDisplayText } from "@/lib/display";
import { clockTime, pct, shares, usd } from "@/lib/format";
import type { ActivityEvent, PortfolioSnapshot } from "@/lib/types";

export function Dashboard() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pRes, aRes] = await Promise.all([
        fetch("/api/portfolio", { cache: "no-store" }),
        fetch("/api/activity", { cache: "no-store" }),
      ]);
      const p = (await pRes.json()) as PortfolioSnapshot;
      const a = (await aRes.json()) as { events: ActivityEvent[] };
      setSnapshot(p);
      setActivity(a.events ?? []);
    } catch {
      /* keep last state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Async data fetch: setState only runs after `await`, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Dashboard</h1>
            <p className="text-sm text-[#8a8a8f]">
              {snapshot?.demo
                ? "Sample data. Configure a wallet to see live positions."
                : snapshot?.canTrade
                  ? "Live. Trading enabled."
                  : "Live. Read only mode."}
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-[#8a8a8f] hover:text-white hover:bg-white/5 transition-all"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<CircleDollarSign className="size-4" />}
            label="USDC balance"
            value={usd(snapshot?.account?.usdcBalance)}
          />
          <StatCard
            icon={<Layers className="size-4" />}
            label="Positions value"
            value={usd(snapshot?.portfolio?.positionsValue)}
          />
          <StatCard
            icon={<TrendingUp className="size-4" />}
            label="Total value"
            value={usd(snapshot?.portfolio?.totalValue)}
            accent
          />
          <StatCard
            icon={<Wallet className="size-4" />}
            label="ALGO balance"
            value={shares(snapshot?.account?.algoBalance)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Positions" icon={<Layers className="size-4" />}>
            {snapshot && snapshot.positions.length > 0 ? (
              <div className="space-y-2">
                {snapshot.positions.map((p, i) => (
                  <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-white leading-snug">
                        {cleanDisplayText(p.marketQuestion)}
                      </p>
                      <span
                        className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          p.outcome === "YES"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-rose-500/15 text-rose-300"
                        }`}
                      >
                        {p.outcome}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <Field label="Shares" value={shares(p.shares)} />
                      <Field label="Entry" value={usd(p.entryPrice)} />
                      <Field label="Price" value={pct(p.currentPrice)} />
                      <Field label="Value" value={usd(p.value)} />
                    </div>
                    {p.unrealizedPnl !== undefined && (
                      <div
                        className={`mt-1.5 text-xs font-medium ${
                          p.unrealizedPnl >= 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {p.unrealizedPnl >= 0 ? "+" : ""}
                        {usd(p.unrealizedPnl)} unrealized
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No open positions.</Empty>
            )}
          </Panel>

          <Panel title="Orders" icon={<ScrollText className="size-4" />}>
            {snapshot && snapshot.orders.length > 0 ? (
              <div className="space-y-2">
                {snapshot.orders.map((o, i) => (
                  <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <p className="text-sm text-white leading-snug">
                      {cleanDisplayText(o.marketQuestion)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8a8a8f]">
                      <span className={o.outcome === "YES" ? "text-emerald-300" : "text-rose-300"}>
                        {o.side} {o.outcome}
                      </span>
                      <span>@ {pct(o.price)}</span>
                      <span>
                        {shares(o.filled)}/{shares(o.quantity)}
                      </span>
                      <span className="capitalize">{o.status.toLowerCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No open orders.</Empty>
            )}
          </Panel>
        </div>

        <Panel title="Activity log" icon={<ScrollText className="size-4" />}>
          {activity.length > 0 ? (
            <div className="space-y-1.5">
              {activity.map((e) => (
                <div key={e.id} className="flex items-start gap-3 py-1.5 border-b border-white/[0.03] last:border-0">
                  <span className="text-[11px] text-[#5a5a5f] font-mono mt-0.5 shrink-0 w-[68px]">
                    {clockTime(e.timestamp)}
                  </span>
                  <span className="shrink-0">
                    <ActivityDot type={e.type} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#c8c8cd] leading-snug">{e.description}</p>
                    {(e.marketQuestion || e.costUsdc !== undefined) && (
                      <p className="text-xs text-[#6a6a6f] truncate">
                        {e.marketQuestion ? cleanDisplayText(e.marketQuestion) : null}
                        {e.costUsdc !== undefined && ` · ${usd(e.costUsdc)}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No activity yet. Build a strategy in the chat to get started.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-[#1488fc]/25 bg-[#1488fc]/[0.06]"
          : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-[#8a8a8f] mb-1.5">
        {icon} {label}
      </div>
      <div className={`text-lg font-semibold ${accent ? "text-[#7cc0ff]" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.01] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 text-sm font-semibold text-white">
        {icon} {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[#6a6a6f]">{label}</div>
      <div className="text-[#d0d0d5]">{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#6a6a6f] py-4 text-center">{children}</p>;
}

function ActivityDot({ type }: { type: ActivityEvent["type"] }) {
  const color =
    type === "error"
      ? "bg-rose-400"
      : type === "trade_filled" || type === "strategy_approved"
        ? "bg-emerald-400"
        : type === "trade_submitted" || type === "signal_purchased"
          ? "bg-amber-400"
          : "bg-[#4da5fc]";
  return <span className={`block size-2 rounded-full mt-1.5 ${color}`} />;
}
