export const PUSH_MAX_OPS = 100;

export type SyncTable = "highlights" | "bookmarks" | "voices" | "tags" | "progress" | "settings";
export type SyncOpKind = "put" | "delete";

export type SyncOp = {
  op: SyncOpKind;
  table: SyncTable;
  id: string;
  updatedAt?: string;
  row?: Record<string, unknown>;
};

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function parseOps(raw: unknown): SyncOp[] | null {
  if (!raw || typeof raw !== "object") return null;
  const ops = (raw as { ops?: unknown }).ops;
  if (!Array.isArray(ops)) return null;
  const out: SyncOp[] = [];
  const tables: SyncTable[] = ["highlights", "bookmarks", "voices", "tags", "progress", "settings"];
  for (const item of ops) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const op = rec.op === "delete" ? "delete" : rec.op === "put" ? "put" : null;
    const table = rec.table;
    if (!op || typeof table !== "string" || !tables.includes(table as SyncTable)) continue;
    const id = str(rec.id) || str((rec.row as Record<string, unknown> | undefined)?.bookId);
    if (!id && table !== "settings" && table !== "progress") continue;
    out.push({
      op,
      table: table as SyncTable,
      id: id || (table === "settings" ? "settings" : ""),
      updatedAt: str(rec.updatedAt) || undefined,
      row: rec.row && typeof rec.row === "object" ? (rec.row as Record<string, unknown>) : rec,
    });
  }
  return out;
}
