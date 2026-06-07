import { Search, Tag, Target } from "lucide-react";
import { cleanDisplayText } from "@/lib/display";
import { pct, usd } from "@/lib/format";
import type { DiscoveryResult } from "@/lib/types";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.06] text-[#c0c0c5] border border-white/5">
      {children}
    </span>
  );
}

export function Interpretation({ discovery }: { discovery: DiscoveryResult }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {discovery.entities.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#6a6a6f] mb-1.5">
              <Tag className="size-3" /> Entities
            </div>
            <div className="flex flex-wrap gap-1.5">
              {discovery.entities.map((e) => (
                <Chip key={e}>{e}</Chip>
              ))}
            </div>
          </div>
        )}
        {discovery.themes.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#6a6a6f] mb-1.5">
              <Target className="size-3" /> Themes
            </div>
            <div className="flex flex-wrap gap-1.5">
              {discovery.themes.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#6a6a6f] mb-2">
          <Search className="size-3" /> Relevant markets ({discovery.markets.length})
        </div>
        {discovery.markets.length === 0 ? (
          <p className="text-sm text-[#8a8a8f]">
            No directly relevant markets found. Try rephrasing your belief.
          </p>
        ) : (
          <div className="space-y-2">
            {discovery.markets.map((m, i) => (
              <div
                key={m.marketId || `${m.marketAppId}-${i}`}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-white font-medium leading-snug">
                    {cleanDisplayText(m.question)}
                  </p>
                  <span
                    className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      m.relationship === "direct"
                        ? "bg-[#1488fc]/20 text-[#7cc0ff]"
                        : "bg-white/10 text-[#a0a0a5]"
                    }`}
                  >
                    {m.relationship}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8a8a8f]">
                  <span>Relevance {pct(m.relevance)}</span>
                  {m.yesProbability !== undefined && <span>YES {pct(m.yesProbability)}</span>}
                  {m.noProbability !== undefined && <span>NO {pct(m.noProbability)}</span>}
                  {m.volume !== undefined && <span>Vol {usd(m.volume, 0)}</span>}
                </div>
                {m.reason && (
                  <p className="mt-1.5 text-xs text-[#6a6a6f]">{cleanDisplayText(m.reason)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
