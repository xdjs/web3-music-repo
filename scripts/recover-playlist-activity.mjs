import { readFileSync, writeFileSync } from "node:fs";
const file = "evidence/sound-wayback/playlist-data.json";
const raw = JSON.parse(readFileSync(file));
const source =
  "https://web.archive.org/web/20230120200848/https://www.sound.xyz/playlist/04150d7a-d471-48de-a144-54b00474e59f";
const ids = raw.props.pageProps.shelf.trackIds;
const releases = new Map();
function walk(value) {
  if (Array.isArray(value)) value.forEach(walk);
  else if (value && typeof value === "object") {
    if (value.__typename === "Release" && value.track?.id && value.artist?.name)
      releases.set(value.track.id, value);
    Object.values(value).forEach(walk);
  }
}
walk(raw.props.pageProps);
const tracks = ids.map((id) => {
  const r = releases.get(id);
  if (!r) throw Error("Missing exact track " + id);
  return {
    id,
    title: r.title,
    artist: r.artist.name,
    artistHandle: r.artist.soundHandle,
    titleSlug: r.titleSlug,
    coverURL: r.coverImage?.url,
    source,
    capturedAt: "2023-01-20",
    recoveryMethod:
      "Exact track ID from embedded archived playlist activity or release page data; original playlist order unchanged",
  };
});
writeFileSync(
  "data/playlist-activity-recovery.json",
  JSON.stringify(tracks, null, 2) + "\n",
);
console.log(
  `Recovered ${tracks.length}/${ids.length} exact ordered playlist track details`,
);
