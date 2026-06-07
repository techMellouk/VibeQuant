/** Client-safe formatting helpers (no SDK / server imports). */

const EMPTY = "n/a";

export function usd(value: number | undefined, digits = 2): string {
  if (value === undefined || Number.isNaN(value)) return EMPTY;
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function pct(value: number | undefined, digits = 0): string {
  if (value === undefined || Number.isNaN(value)) return EMPTY;
  return `${(value * 100).toFixed(digits)}%`;
}

export function shares(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return EMPTY;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
