export function selectDirectoryArtist(payload, identity) {
  if (!Array.isArray(payload?.results)) return null;
  const row = payload.results.find(
    (r) =>
      r &&
      r.id === identity.id &&
      r.isExternalOnly === false &&
      r[identity.field] === identity.value,
  );
  if (!row) return null;
  return {
    id: identity.id,
    name: identity.name,
    url: `https://musicnerd.net/artist/${identity.id}`,
  };
}

export async function readDirectoryArtist(identity, fetcher = fetch) {
  try {
    const response = await fetcher(
      "https://api.musicnerd.net/api/searchArtists",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: identity.name }),
        signal: AbortSignal.timeout(6500),
      },
    );
    if (!response.ok) return { status: "unavailable" };
    const artist = selectDirectoryArtist(await response.json(), identity);
    return artist ? { status: "live", artist } : { status: "unconfirmed" };
  } catch {
    return { status: "unavailable" };
  }
}
