// Server-only private Blob persistence. Authorization happens in account-api.mjs:
// accountId must be the canonical UUID obtained from the verified Privy identity.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 524288;
const empty = () => ({ revision: 0, playlists: [] });
const accountKey = (id) => {
  if (typeof id !== "string" || !UUID.test(id)) throw Error("Invalid account");
  return id.toLowerCase();
};
function playlistsValue(value) {
  if (!Array.isArray(value) || value.length > 100)
    throw Error("Invalid playlists");
  const ids = new Set();
  return value.map((p) => {
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.id !== "string" ||
      !p.id ||
      p.id.length > 100 ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 100 ||
      !Array.isArray(p.recordIds) ||
      p.recordIds.length > 5000 ||
      p.recordIds.some((id) => typeof id !== "string" || !id || id.length > 200)
    )
      throw Error("Invalid playlists");
    ids.add(p.id);
    const result = { id: p.id, name: p.name, recordIds: [...p.recordIds] };
    for (const key of ["createdAt", "updatedAt"]) {
      if (p[key] !== undefined) {
        if (
          typeof p[key] !== "string" ||
          p[key].length > 40 ||
          !Number.isFinite(Date.parse(p[key]))
        )
          throw Error("Invalid playlists");
        result[key] = p[key];
      }
    }
    return result;
  });
}
function privateResult(blob, pathname) {
  if (
    !blob ||
    blob.pathname !== pathname ||
    typeof blob.etag !== "string" ||
    !blob.etag
  )
    throw Error("Private storage response invalid");
  const url = new URL(blob.url);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".private.blob.vercel-storage.com") ||
    url.username ||
    url.password
  )
    throw Error("Private storage required");
}
async function streamJSON(stream) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of stream) {
    bytes += chunk.byteLength;
    if (bytes > MAX_BYTES) throw Error("Stored playlist library too large");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createDurableAccountPlaylistStore({
  sdk,
  loadSdk = () => import("@vercel/blob"),
  namespace = "production",
  storeId,
  token,
  timeoutMs = 10000,
} = {}) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(namespace))
    throw Error("Invalid storage namespace");
  let sdkPromise;
  const client = () =>
    sdk ? Promise.resolve(sdk) : (sdkPromise ||= loadSdk());
  const options = () => ({
    access: "private",
    ...(storeId ? { storeId } : {}),
    ...(token ? { token } : {}),
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
  const pathname = (id) =>
    `account-playlists-v1/${namespace}/${accountKey(id)}.json`;
  async function snapshot(id) {
    const key = accountKey(id),
      path = pathname(key);
    const result = await (
      await client()
    ).get(path, { ...options(), useCache: false });
    if (result === null) return { value: empty(), etag: null };
    if (result?.statusCode !== 200 || !result.stream)
      throw Error("Private storage read unavailable");
    privateResult(result.blob, path);
    if (Number.isFinite(result.blob.size) && result.blob.size > MAX_BYTES)
      throw Error("Stored playlist library too large");
    const data = await streamJSON(result.stream);
    if (
      !data ||
      data.schemaVersion !== 1 ||
      data.accountId !== key ||
      !Number.isSafeInteger(data.revision) ||
      data.revision < 1 ||
      typeof data.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(data.updatedAt))
    )
      throw Error("Stored playlist identity or revision invalid");
    let playlists;
    try {
      playlists = playlistsValue(data.playlists);
    } catch {
      throw Error("Stored playlist data invalid");
    }
    return {
      value: { revision: data.revision, playlists, updatedAt: data.updatedAt },
      etag: result.blob.etag,
    };
  }
  return {
    kind: "private-blob",
    read: async (id) => (await snapshot(id)).value,
    write: async (id, revision, playlists) => {
      const key = accountKey(id);
      if (
        !Number.isSafeInteger(revision) ||
        revision < 0 ||
        revision >= Number.MAX_SAFE_INTEGER
      )
        throw Error("Invalid playlists");
      const safePlaylists = playlistsValue(playlists);
      const current = await snapshot(key);
      if (current.value.revision !== revision)
        return { conflict: true, ...current.value };
      const next = {
        revision: revision + 1,
        playlists: safePlaylists,
        updatedAt: new Date().toISOString(),
      };
      const body = JSON.stringify({
        schemaVersion: 1,
        accountId: key,
        ...next,
      });
      if (Buffer.byteLength(body) > MAX_BYTES) throw Error("Invalid playlists");
      try {
        const result = await (
          await client()
        ).put(pathname(key), body, {
          ...options(),
          addRandomSuffix: false,
          contentType: "application/json",
          cacheControlMaxAge: 60,
          ...(current.etag
            ? { allowOverwrite: true, ifMatch: current.etag }
            : { allowOverwrite: false }),
        });
        privateResult(result, pathname(key));
        return next;
      } catch (error) {
        // Includes initial-create races. Never retry an unconditional overwrite,
        // and never turn provider failures into an empty successful library.
        const latest = await snapshot(key);
        if (latest.value.revision !== revision)
          return { conflict: true, ...latest.value };
        throw error;
      }
    },
  };
}
