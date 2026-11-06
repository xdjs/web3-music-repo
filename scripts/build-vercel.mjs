import { cp, mkdir, readdir, rm, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { buildCatalogPayload } from "../server.mjs";
await import("./build-account.mjs");
await rm("dist", { recursive: true, force: true });
await mkdir("dist/src", { recursive: true });
await cp("public", "dist", {
  recursive: true,
  filter: (source) => !source.endsWith(".audio") && !source.endsWith(".tmp"),
});
await copyFile("archive.html", "dist/index.html");
const frontend = [
  "archive.js",
  "nav-icons.mjs",
  "release-date.mjs",
  "catalog-royalty-ui.mjs",
  "archive.css",
  "music-facts.mjs",
  "lyrics-ui.mjs",
  "extract-music-metadata.mjs",
  "wallet-library-ui.mjs",
  "wallet-library-state.mjs",
  "collectors-ui.mjs",
  "media-recovery.js",
  "media-preload.mjs",
  "next-track-buffer.mjs",
  "playback-controls.mjs",
  "now-playing.mjs",
  "personal-playlists.mjs",
  "playlist-share.mjs",
  "entity-share.mjs",
  "collection-filters.mjs",
  "listening-queue.mjs",
  "queue-shuffle.mjs",
  "queue-sortable.mjs",
  "recovery-model.mjs",
  "solana-identity.mjs",
  "solana-provenance.mjs",
  "asset-capabilities.mjs",
  "image-recovery.mjs",
];
for (const file of frontend) await copyFile(`src/${file}`, `dist/src/${file}`);
// Public recovery data is fixed for each deployment. Static delivery avoids the
// Function response-size limit while private account routes remain dynamic.
await mkdir("dist/catalog", { recursive: true });
const bundle = createCatalogLoader()();
const delivery = {
  records: bundle.records.length,
  people: bundle.people.length,
};
for (const [name, isIndex] of [
  ["index", true],
  ["full", false],
]) {
  const body = JSON.stringify(buildCatalogPayload(bundle, isIndex));
  await writeFile(`dist/catalog/${name}.json`, body);
  delivery[name] = {
    bytes: Buffer.byteLength(body),
    gzipBytes: gzipSync(body).length,
  };
}
console.log("Public catalog snapshots: " + JSON.stringify(delivery));
const assets = [];
async function scan(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await scan(path.join(dir, entry.name), name);
    else if (entry.isFile()) assets.push("/" + name);
  }
}
await scan("dist");
await writeFile("data/static-assets.json", JSON.stringify(assets));
console.log(
  `Static frontend ready: ${assets.length} files; backend data stays in the function bundle.`,
);
