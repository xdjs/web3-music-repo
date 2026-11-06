import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { createHash } from "node:crypto";
import {
  sanitizeSuperRelease,
  supercollectorBundle,
  SUPER_SOURCE,
} from "../src/supercollector.mjs";
const dir = "data/supercollector";
mkdirSync(dir, { recursive: true });
const checkedAt = new Date().toISOString();
const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return r.text();
};
const next = (html) =>
  JSON.parse(
    html.match(
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
    )?.[1] || "null",
  )?.props?.pageProps;
const index = JSON.parse(await get(SUPER_SOURCE));
if (!Array.isArray(index) || !index.length) throw Error("Invalid public index");
const artists = next(
  await get("https://release.supercollector.xyz/artists"),
).artists;
const artistIDs = new Set(artists.flatMap((a) => a.releases.map((r) => r.id))),
  indexIDs = new Set(index.map((r) => r.id));
if (
  artistIDs.size !== indexIDs.size ||
  [...artistIDs].some((id) => !indexIDs.has(id))
)
  throw Error(
    "Artist-directory/index disagreement: review scope before importing",
  );
let releases = [],
  failures = [];
if (existsSync(dir + "/inventory.json"))
  releases = JSON.parse(readFileSync(dir + "/inventory.json")).releases || [];
releases = releases.filter((r) => indexIDs.has(r.id));
const save = () => {
  const v = {
    checkedAt,
    indexSource: SUPER_SOURCE,
    directorySource: "https://release.supercollector.xyz/artists",
    indexReleases: index.length,
    indexTracks: index.reduce((n, r) => n + r.tracks.length, 0),
    directoryArtists: artists.length,
    directoryReleases: artistIDs.size,
    releases,
    failures,
  };
  writeFileSync(dir + "/inventory.json.tmp", JSON.stringify(v, null, 2) + "\n");
  renameSync(dir + "/inventory.json.tmp", dir + "/inventory.json");
};
for (const r of index) {
  if (process.argv.includes("--resume") && releases.some((x) => x.id === r.id))
    continue;
  try {
    const html = await get(
      "https://release.supercollector.xyz/" + encodeURIComponent(r.slug),
    );
    const page = next(html);
    const refreshed = sanitizeSuperRelease(
      page.release,
      r,
      checkedAt,
      createHash("sha256").update(html).digest("hex"),
    );
    releases = releases.filter((x) => x.id !== r.id);
    releases.push(refreshed);
  } catch (e) {
    failures.push({ id: r.id, slug: r.slug, reason: e.message });
  }
  save();
  if ((releases.length + failures.length) % 20 === 0)
    console.log("checked", releases.length, "failed", failures.length);
  await new Promise((resolve) => setTimeout(resolve, 550));
}
if (failures.length)
  throw Error(
    "Release refresh incomplete; checkpoint retained and previous playback bundle preserved",
  );
const bundle = supercollectorBundle(releases, checkedAt);
writeFileSync(
  dir + "/recovered-media.json.tmp",
  JSON.stringify(bundle, null, 2) + "\n",
);
renameSync(dir + "/recovered-media.json.tmp", dir + "/recovered-media.json");
console.log(
  JSON.stringify({
    indexReleases: index.length,
    indexTracks: index.reduce((n, r) => n + r.tracks.length, 0),
    checked: releases.length,
    failures: failures.length,
    publicTracks: bundle.records.length,
    withheld: bundle.unresolved.length,
    chains: [...new Set(releases.map((r) => r.chainId))],
  }),
);
