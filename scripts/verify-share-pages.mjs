import { chromium } from "playwright";
import { createServer } from "node:http";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import { handler } from "../server.mjs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { encodePlaylistShare } from "../src/playlist-share.mjs";
const bundle = createCatalogLoader()();
const record = bundle.records.find(
  (r) => r.kind !== "artwork" && bundle.evidence[r.id]?.localImage,
);
if (!record) throw Error("No local artwork fixture");
const playlist = JSON.parse(readFileSync("data/historical-playlists.json"))[0];
const token = await encodePlaylistShare({
  name: "Late Night Recovery",
  recordIds: [record.id],
});
const server = createServer(handler);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const cases = [
  ["record", record.id, "/#record/" + record.id],
  ["artist", "pete-rango", "/#artist/pete-rango"],
  ["playlist", playlist.id, "/#historic-playlists/" + playlist.id],
  ["mix", token, "/#shared-playlist/" + token],
];
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Actual current handler HTTP metadata and JS landing checks; no account submissions or remote image proxying.",
  http: [],
  landings: [],
  views: [],
};
const browser = await chromium.launch({ headless: true });
try {
  for (const [kind, id, target] of cases) {
    const path = "/share/" + kind + "/" + encodeURIComponent(id),
      r = await fetch(origin + path),
      html = await r.text();
    const meta = (name) =>
      html.match(
        new RegExp('(?:property|name)="' + name + '" content="([^"]*)"'),
      )?.[1];
    if (
      r.status !== 200 ||
      !meta("og:title") ||
      !meta("og:image") ||
      meta("og:image") !== meta("twitter:image") ||
      !html.includes("location.replace")
    )
      throw Error("Missing metadata " + kind);
    report.http.push({
      kind,
      status: r.status,
      title: meta("og:title"),
      image: meta("og:image"),
      canonical: meta("og:url"),
      cacheControl: r.headers.get("cache-control"),
      target,
    });
    const page = await browser.newPage();
    await page.goto(origin + path);
    await page.waitForURL(origin + target, { timeout: 20000 });
    await page.locator("main h1").first().waitFor({ timeout: 30000 });
    const h1 = await page.locator("main h1").first().innerText();
    const paused = await page.locator("#audio").evaluate((m) => m.paused);
    if (!paused) throw Error("Share auto-played audio");
    report.landings.push({ kind, target, h1, paused });
    await page.close();
  }
  const bad = await fetch(origin + "/share/record/does-not-exist");
  if (bad.status !== 404) throw Error("Unknownshareaccepted");
  const head = await fetch(origin + "/share/artist/pete-rango", {
    method: "HEAD",
  });
  if (head.status !== 200 || (await head.text()) !== "")
    throw Error("HEADinvalid");
  report.unknownStatus = bad.status;
  report.headStatus = head.status;
  const video = "/media/planet-x-artist-corrected-720.mp4";
  const r = await fetch(origin + video, { headers: { Range: "bytes=0-31" } });
  const bytes = Buffer.from(await r.arrayBuffer());
  const fd = openSync("public" + video, "r"),
    expected = Buffer.alloc(32);
  readSync(fd, expected, 0, 32, 0);
  closeSync(fd);
  if (
    r.status !== 206 ||
    !expected.equals(bytes) ||
    r.headers.get("content-type") !== "video/mp4"
  )
    throw Error("Actual MP4 range failed");
  report.videoRange = {
    status: r.status,
    contentRange: r.headers.get("content-range"),
    contentType: r.headers.get("content-type"),
    bytes: bytes.length,
    matchesOriginalFile: true,
  };
  mkdirSync("captures", { recursive: true });
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        javaScriptEnabled: false,
      });
      const page = await context.newPage();
      await page.goto(origin + "/share/record/" + record.id);
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await page.locator(".cover img").evaluate((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 5000);
            }),
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (overflow) throw Error("Sharepage horizontaloverflow");
      const path = `captures/share-landing-${width}-${theme}.png`;
      await page.screenshot({ path, fullPage: true });
      report.views.push({
        width,
        theme,
        overflow,
        path,
        artworkLoaded: await page
          .locator(".cover img")
          .evaluate((i) => i.complete && i.naturalWidth > 0),
      });
      await context.close();
    }
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  writeFileSync(
    "data/share-pages-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({
    http: report.http.length,
    landings: report.landings.length,
    views: report.views.length,
    videoRange: report.videoRange,
    unknown: report.unknownStatus,
  }),
);
