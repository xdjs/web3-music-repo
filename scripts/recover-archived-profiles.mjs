import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
const captures = JSON.parse(
  readFileSync("evidence/sound-wayback/monthly-captures.json"),
)
  .slice(1)
  .filter((r) => r[1] < "202501");
const existing = JSON.parse(readFileSync("data/historical-profiles.json"));
const profiles = new Map(existing.map((p) => [p.address.toLowerCase(), p]));
const report = { startedAt: new Date().toISOString(), captures: [] };
mkdirSync("evidence/sound-wayback/monthly", { recursive: true });
function walk(x, source, capturedAt) {
  if (Array.isArray(x)) {
    x.forEach((v) => walk(v, source, capturedAt));
    return;
  }
  if (!x || typeof x !== "object") return;
  if (
    /^0x[0-9a-f]{40}$/i.test(x.publicAddress) &&
    typeof x.username === "string"
  ) {
    const address = x.publicAddress.toLowerCase();
    let avatarURL = null;
    try {
      const u = new URL(x.avatar?.url);
      if (
        u.protocol === "https:" &&
        u.hostname === "d2i9ybouka0ieh.cloudfront.net"
      )
        avatarURL = u.href;
    } catch {}
    const prior = profiles.get(address);
    if (
      !prior ||
      (avatarURL && (!prior.avatarURL || capturedAt > prior.capturedAt))
    ) {
      profiles.set(address, {
        address,
        name: x.username,
        soundURL: x.webappUri?.startsWith("https://www.sound.xyz/")
          ? x.webappUri
          : null,
        avatarURL,
        capturedAt,
        source,
        artistRole: x.hasArtistRole === true,
        ...(prior?.avatarURL === avatarURL && prior.localAvatar
          ? {
              localAvatar: prior.localAvatar,
              avatarRetrievedAt: prior.avatarRetrievedAt,
            }
          : {}),
      });
    }
  }
  Object.values(x).forEach((v) => walk(v, source, capturedAt));
}
let index = 0;
async function worker() {
  while (index < captures.length) {
    const row = captures[index++],
      ts = row[1],
      url = `https://web.archive.org/web/${ts}id_/https://www.sound.xyz/`,
      file = `evidence/sound-wayback/monthly/${ts}.json`;
    try {
      let data;
      if (existsSync(file)) data = JSON.parse(readFileSync(file));
      else {
        const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw Error("HTTP " + r.status);
        const html = await r.text();
        const match = html.match(
          /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
        );
        if (!match) throw Error("No embedded Next page data");
        data = JSON.parse(match[1]);
        writeFileSync(file, JSON.stringify(data));
      }
      const capturedAt =
        ts.slice(0, 4) + "-" + ts.slice(4, 6) + "-" + ts.slice(6, 8);
      walk(data, url.replace("id_/", "/"), capturedAt);
      report.captures.push({ timestamp: ts, status: "recovered", source: url });
      writeFileSync(
        "data/historical-profiles.json",
        JSON.stringify([...profiles.values()], null, 2),
      );
      console.log("ARCHIVE", ts, profiles.size, "profiles");
    } catch (e) {
      report.captures.push({
        timestamp: ts,
        status: "unavailable",
        reason: e.message,
      });
      console.log("ARCHIVE GAP", ts, e.message);
    }
    writeFileSync(
      "data/profile-recovery-report.json",
      JSON.stringify(report, null, 2),
    );
    await new Promise((r) => setTimeout(r, 1500));
  }
}
await Promise.all([worker(), worker()]);
report.finishedAt = new Date().toISOString();
writeFileSync(
  "data/profile-recovery-report.json",
  JSON.stringify(report, null, 2),
);
console.log("PROFILE RECOVERY FINISHED", profiles.size);
