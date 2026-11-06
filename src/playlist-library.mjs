export const GUEST_PLAYLIST_KEY = "mn-archive-playlists-v1";
export function playlistStorageKey(accountId) {
  return accountId
    ? "mn-archive-account-library-v1:" + encodeURIComponent(accountId)
    : GUEST_PLAYLIST_KEY;
}
export function readPlaylistCache(storage, key) {
  const raw = storage.getItem(key);
  if (!raw) return { playlists: [] };
  const value = JSON.parse(raw);
  const cache = Array.isArray(value) ? { playlists: value } : value;
  if (!cache || !Array.isArray(cache.playlists))
    throw Error("Saved playlist data could not be read.");
  for (const field of ["playlists", "base", "guestBaseline"]) {
    if (cache[field] === undefined) continue;
    if (
      !Array.isArray(cache[field]) ||
      cache[field].some(
        (p) =>
          !p ||
          typeof p.id !== "string" ||
          typeof p.name !== "string" ||
          !Array.isArray(p.recordIds) ||
          p.recordIds.some((id) => typeof id !== "string"),
      )
    )
      throw Error("Saved playlist data could not be read.");
  }
  if (
    cache.pendingWrite &&
    (!Array.isArray(cache.pendingWrite.playlists) ||
      !Number.isSafeInteger(cache.pendingWrite.revision))
  )
    throw Error("Pending playlist data could not be read.");
  return cache;
}
export function writePlaylistLists(storage, key, playlists) {
  const value =
    key === GUEST_PLAYLIST_KEY
      ? playlists
      : { ...readPlaylistCache(storage, key), playlists };
  storage.setItem(key, JSON.stringify(value));
}
export function playlistContent(value) {
  if (!value) return null;
  return { id: value.id, name: value.name, recordIds: value.recordIds };
}
export const samePlaylists = (a, b) =>
  JSON.stringify(a.map(playlistContent)) ===
  JSON.stringify(b.map(playlistContent));
const equal = (a, b) =>
  JSON.stringify(playlistContent(a)) === JSON.stringify(playlistContent(b));
function hash(value) {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}
// A conflict never silently chooses a name/order/track edit over another edit.
// Preserve the remote version and a deterministic local copy for review.
export function mergePlaylistLibraries(base, local, remote) {
  const b = new Map(base.map((p) => [p.id, p])),
    l = new Map(local.map((p) => [p.id, p])),
    r = new Map(remote.map((p) => [p.id, p]));
  const ids = new Set([
    ...remote.map((p) => p.id),
    ...local.map((p) => p.id),
    ...base.map((p) => p.id),
  ]);
  const output = new Map();
  let conflicts = 0;
  for (const id of ids) {
    const before = b.get(id),
      ours = l.get(id),
      theirs = r.get(id);
    let selected;
    if (equal(ours, theirs)) selected = ours;
    else if (equal(ours, before)) selected = theirs;
    else if (equal(theirs, before)) selected = ours;
    else {
      conflicts++;
      if (theirs) output.set(id, theirs);
      if (ours) {
        const copyId =
          id.slice(0, 65) +
          "-recovered-" +
          hash(JSON.stringify(playlistContent(ours)));
        output.set(copyId, {
          ...ours,
          id: copyId,
          name: ours.name.slice(0, 83) + " (recovered edit)",
        });
      }
      continue;
    }
    if (selected) output.set(id, selected);
  }
  return { playlists: structuredClone([...output.values()]), conflicts };
}
