/** Bundled companion ids are `theo-hl-feeling`. Origin rows suffix the club: `theo-hl-feeling-a1b2c3d4`. */

const COMPANION = /^(theo-(?:hl|v)-[a-z]+)(?:-[0-9a-f]{8})?$/i;

export function companionKey(id: string): string | null {
  const m = COMPANION.exec(id.trim());
  return m?.[1]?.toLowerCase() ?? null;
}

export function sameCompanion(a: string, b: string): boolean {
  const ka = companionKey(a);
  return ka != null && ka === companionKey(b);
}

/** On pull, adopt the origin id so local `theo-hl-feeling` becomes the club row. */
export function remapLocalId(localId: string, remoteIds: string[]): string {
  const key = companionKey(localId);
  if (!key) return localId;
  const hit = remoteIds.find((id) => companionKey(id) === key);
  return hit ?? localId;
}
