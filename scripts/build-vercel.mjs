import { cp, mkdir, readdir, rm, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
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
  "wallet-library-ui.mjs",
  "collectors-ui.mjs",
  "media-recovery.js",
  "media-preload.mjs",
  "personal-playlists.mjs",
  "playlist-share.mjs",
  "listening-queue.mjs",
  "recovery-model.mjs",
  "image-recovery.mjs",
];
for (const file of frontend) await copyFile(`src/${file}`, `dist/src/${file}`);
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
