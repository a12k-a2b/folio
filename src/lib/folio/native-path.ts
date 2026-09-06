/** Path parser for `/api/native/v1/*`. Shared with tests so Kotlin/Swift stay honest. */

export type NativeRoute =
  | { name: "health" }
  | { name: "catalog" }
  | { name: "catalogBook"; bookId: string }
  | { name: "me" }
  | { name: "library" }
  | { name: "snapshot"; bookId: string }
  | { name: "progress" }
  | { name: "highlights" }
  | { name: "highlight"; id: string }
  | { name: "bookmarks" }
  | { name: "bookmark"; id: string }
  | { name: "voices" }
  | { name: "voice"; id: string }
  | { name: "tags" }
  | { name: "settings" }
  | { name: "push" }
  | { name: "blobs" }
  | { name: "blob"; id: string }
  | { name: "blobData"; id: string }
  | { name: "blobComplete"; id: string };

const PREFIX = "/api/native/v1";

export function parseNativePath(pathname: string): NativeRoute | null {
  const raw = pathname.split("?")[0] ?? pathname;
  const path = raw.endsWith("/") && raw.length > 1 ? raw.slice(0, -1) : raw;
  if (!path.startsWith(PREFIX)) return null;
  const rest = path.slice(PREFIX.length).replace(/^\//, "");
  if (!rest || rest === "health") return { name: "health" };
  if (rest === "catalog") return { name: "catalog" };
  if (rest === "me") return { name: "me" };
  if (rest === "library") return { name: "library" };
  if (rest === "progress") return { name: "progress" };
  if (rest === "highlights") return { name: "highlights" };
  if (rest === "bookmarks") return { name: "bookmarks" };
  if (rest === "voices") return { name: "voices" };
  if (rest === "tags") return { name: "tags" };
  if (rest === "settings") return { name: "settings" };
  if (rest === "push") return { name: "push" };
  if (rest === "blobs") return { name: "blobs" };
  const catalog = /^catalog\/([^/]+)$/.exec(rest);
  if (catalog) return { name: "catalogBook", bookId: decodeURIComponent(catalog[1]) };
  const snap = /^snapshot\/([^/]+)$/.exec(rest);
  if (snap) return { name: "snapshot", bookId: decodeURIComponent(snap[1]) };
  const hl = /^highlights\/([^/]+)$/.exec(rest);
  if (hl) return { name: "highlight", id: decodeURIComponent(hl[1]) };
  const bm = /^bookmarks\/([^/]+)$/.exec(rest);
  if (bm) return { name: "bookmark", id: decodeURIComponent(bm[1]) };
  const vo = /^voices\/([^/]+)$/.exec(rest);
  if (vo) return { name: "voice", id: decodeURIComponent(vo[1]) };
  const blobComplete = /^blobs\/([^/]+)\/complete$/.exec(rest);
  if (blobComplete) return { name: "blobComplete", id: decodeURIComponent(blobComplete[1]) };
  const blobData = /^blobs\/([^/]+)\/data$/.exec(rest);
  if (blobData) return { name: "blobData", id: decodeURIComponent(blobData[1]) };
  const blob = /^blobs\/([^/]+)$/.exec(rest);
  if (blob) return { name: "blob", id: decodeURIComponent(blob[1]) };
  return null;
}

export const NATIVE_PROTOCOL = "folio-native/1";
export const SYNC_VERSION = "v1.1";
export const POWERSYNC_LOCKED = true;
