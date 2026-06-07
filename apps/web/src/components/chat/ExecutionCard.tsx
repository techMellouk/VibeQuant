import { CheckCircle2, Circle, XCircle, MinusCircle, ExternalLink } from "lucide-react";
import { cleanDisplayText } from "@/lib/display";
import { usd } from "@/lib/format";
import type { ExecutionLeg, ExecutionReport } from "@/lib/types";

function StatusIcon({ status }: { status: ExecutionLeg["status"] }) {
  switch (status) {
    case "filled":
      return <CheckCircle2 className="size-4 text-emerald-400" />;
    case "partial":
      return <Circle className="size-4 text-amber-400" />;
    case "failed":
      return <XCircle className="size-4 text-rose-400" />;
    default:
      return <MinusCircle className="size-4 text-[#6a6a6f]" />;
  }
}

export function ExecutionCard({ report }: { report: ExecutionReport }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 text-sm font-semibold text-white">
        Execution report
      </div>
      <div className="divide-y divide-white/5">
        {report.results.map((leg, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5">
                <StatusIcon status={leg.status} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug">
                  {cleanDisplayText(leg.marketQuestion)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8a8a8f]">
                  <span
                    className={
                      leg.outcome === "YES" ? "text-emerald-300" : "text-rose-300"
                    }
                  >
                    {leg.outcome}
                  </span>
                  <span>{usd(leg.amount)}</span>
                  <span className="capitalize">{leg.status}</span>
                  {leg.fillPrice !== undefined && <span>@ {usd(leg.fillPrice)}</span>}
                  {leg.txIds[0] && (
                    <span className="inline-flex items-center gap-1 text-[#6a6a6f]">
                      <ExternalLink className="size-3" />
                      {leg.txIds[0].slice(0, 8)}…
                    </span>
                  )}
                </div>
                {leg.message && (
                  <p className="mt-1 text-xs text-[#6a6a6f]">{cleanDisplayText(leg.message)}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
