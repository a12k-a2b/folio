/** Client clocks for HTTP v1.1. Future skew is clamped; the past (garden offline) is kept. */

export const SKEW_MS = 24 * 60 * 60 * 1000;

export function resolveUpdatedAt(client: string | undefined | null, now = Date.now()): string {
  const t = Date.parse(client ?? "");
  if (!Number.isFinite(t)) return new Date(now).toISOString();
  if (t - now > SKEW_MS) return new Date(now).toISOString();
  return new Date(t).toISOString();
}

export function isNewer(a: string | Date, b: string | Date): boolean {
  const ta = a instanceof Date ? a.getTime() : Date.parse(String(a));
  const tb = b instanceof Date ? b.getTime() : Date.parse(String(b));
  const na = Number.isFinite(ta) ? ta : 0;
  const nb = Number.isFinite(tb) ? tb : 0;
  return na > nb;
}

export function stamp(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? new Date(t).toISOString() : String(value);
}
