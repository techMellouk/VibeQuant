"use client";

import {
  ArrowUpRight,
  Check,
  RefreshCw,
  ShieldAlert,
  Wallet,
  X,
  Zap,
  Radio,
} from "lucide-react";
import { cleanDisplayText } from "@/lib/display";
import { pct, usd } from "@/lib/format";
import type { Strategy } from "@/lib/types";

interface StrategyCardProps {
  strategy: Strategy;
  busy?: boolean;
  executed?: boolean;
  onApprove?: () => void;
  onRegenerate?: () => void;
  onCancel?: () => void;
}

export function StrategyCard({
  strategy,
  busy = false,
  executed = false,
  onApprove,
  onRegenerate,
  onCancel,
}: StrategyCardProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-[#4da5fc]" />
          <span className="text-sm font-semibold text-white">Proposed strategy</span>
        </div>
        <span className="text-xs text-[#8a8a8f]">Confidence {pct(strategy.confidence)}</span>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-sm text-[#c8c8cd] leading-relaxed">
          {cleanDisplayText(strategy.explanation)}
        </p>

        <div className="space-y-2">
          {strategy.trades.map((t, i) => (
            <div
              key={`${t.marketAppId}-${i}`}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-white font-medium leading-snug">
                  {cleanDisplayText(t.marketQuestion)}
                </p>
                <span
                  className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    t.outcome === "YES"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {t.outcome}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8a8a8f]">
                <span className="text-white font-medium">{usd(t.amount)}</span>
                <span>{t.orderType}</span>
                {t.limitPrice !== undefined && <span>@ {pct(t.limitPrice)}</span>}
              </div>
              {t.reasoning && <p className="mt-1.5 text-xs text-[#6a6a6f]">{t.reasoning}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat icon={<Wallet className="size-3.5" />} label="Total capital" value={usd(strategy.totalCapital)} />
          <Stat icon={<ShieldAlert className="size-3.5" />} label="Max loss" value={usd(strategy.maximumLoss)} tone="warn" />
          {strategy.signals && strategy.signals.length > 0 && (
            <Stat
              icon={<Radio className="size-3.5" />}
              label="Signal cost"
              value={usd(strategy.signals.reduce((s, x) => s + x.costUsdc, 0))}
            />
          )}
        </div>

        {strategy.signals && strategy.signals.length > 0 && (
          <div className="rounded-xl border border-[#1488fc]/20 bg-[#1488fc]/[0.06] p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#7cc0ff] mb-1">
              <Radio className="size-3.5" /> External signals (x402)
            </div>
            {strategy.signals.map((s, i) => (
              <p key={i} className="text-xs text-[#a0a0a5]">
                <span className="text-[#c8c8cd]">{s.provider}</span>: {s.summary} ({usd(s.costUsdc)})
              </p>
            ))}
          </div>
        )}

        {strategy.risks.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6a6a6f] mb-1.5">Risks</div>
            <ul className="space-y-1">
              {strategy.risks.map((r, i) => (
                <li key={i} className="flex gap-2 text-xs text-[#a0a0a5]">
                  <span className="text-[#6a6a6f]">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!executed && (onApprove || onRegenerate || onCancel) && (
        <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
          <button
            onClick={onApprove}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#1488fc] hover:bg-[#1a94ff] text-white transition-all disabled:opacity-40 active:scale-95 shadow-[0_0_20px_rgba(20,136,252,0.3)]"
          >
            <Check className="size-4" /> Approve &amp; execute
          </button>
          <button
            onClick={onRegenerate}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-[#a0a0a5] hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
          >
            <RefreshCw className="size-4" /> Regenerate
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-[#8a8a8f] hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
          >
            <X className="size-4" /> Cancel
          </button>
        </div>
      )}

      {executed && (
        <div className="px-4 py-3 border-t border-white/5 flex items-center gap-1.5 text-sm text-emerald-300">
          <ArrowUpRight className="size-4" /> Strategy submitted for execution.
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-[#6a6a6f] mb-0.5">
        {icon} {label}
      </div>
      <div className={`text-sm font-semibold ${tone === "warn" ? "text-amber-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
