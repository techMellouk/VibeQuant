/** Normalize copy shown in the UI (no em/en dashes). */

const DASH_RE = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/** Replace dash-like characters with plain punctuation for display. */
export function cleanDisplayText(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ": ")
    .replace(DASH_RE, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
