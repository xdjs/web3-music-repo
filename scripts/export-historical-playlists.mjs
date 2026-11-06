import { readFileSync, writeFileSync, readdirSync } from "node:fs";
export function normalizeCapture(data, source, capturedAt) {
  const page = data.props?.pageProps,
    s = page?.shelf;
  if (!s?.id || !Array.isArray(s.trackIds) || !s.name)
    throw Error("Unsupported playlist capture");
  const byTrack = new Map();
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      if (value.track?.id && value.title && value.artist?.name)
        byTrack.set(value.track.id, {
          ...byTrack.get(value.track.id),
          ...value,
        });
      Object.values(value).forEach(walk);
    }
  };
  walk(page);
  return {
    id: s.id,
    name: s.name,
    description: s.description || "",
    curator: s.user?.username || "Unknown curator",
    capturedAt,
    source,
    declaredCount: s.releaseCount,
    tracks: s.trackIds.map((id, index) => {
      const r = byTrack.get(id);
      if (!r) return { id, index, missing: true };
      return {
        id,
        index,
        title: r.title,
        artist: r.artist.name,
        artistHandle: r.artist.soundHandle,
        titleSlug: r.titleSlug || r.webappUri?.split("/").pop(),
        coverURL: r.coverImage?.url,
        audioURL: r.track.revealedAudio?.url,
        source,
        capturedAt,
        recoveryMethod:
          "Exact archived track ID matched across embedded release and activity data; original playlist order retained",
      };
    }),
  };
}
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const first = JSON.parse(
    readFileSync("evidence/sound-wayback/playlist-data.json"),
  );
  const lists = [
    normalizeCapture(
      first,
      "https://web.archive.org/web/20230120200848/https://www.sound.xyz/playlist/04150d7a-d471-48de-a144-54b00474e59f",
      "2023-01-20T20:08:48Z",
    ),
  ];
  for (const file of readdirSync("evidence/historical-playlists").filter((f) =>
    /^[a-f0-9-]{36}\.json$/.test(f),
  )) {
    const c = JSON.parse(readFileSync("evidence/historical-playlists/" + file));
    const t = c.capturedAt;
    lists.push(
      normalizeCapture(
        c.data,
        c.source,
        `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}Z`,
      ),
    );
  }
  writeFileSync(
    "data/historical-playlists.json",
    JSON.stringify(lists, null, 2) + "\n",
  );
  console.log(
    lists.map((p) => ({
      name: p.name,
      known: p.tracks.filter((t) => !t.missing).length,
      total: p.tracks.length,
    })),
  );
}
