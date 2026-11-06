import { readFile, writeFile } from "node:fs/promises";
const profiles = new Map();
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
    const avatar = x.avatar?.url;
    let avatarURL = null;
    try {
      const u = new URL(avatar);
      if (
        u.protocol === "https:" &&
        u.hostname === "d2i9ybouka0ieh.cloudfront.net"
      )
        avatarURL = u.href;
    } catch {}
    const profile = {
      address,
      name: x.username,
      soundURL: x.webappUri?.startsWith("https://www.sound.xyz/")
        ? x.webappUri
        : null,
      avatarURL,
      capturedAt,
      source,
    };
    if (!profiles.has(address) || avatarURL) profiles.set(address, profile);
  }
  Object.values(x).forEach((v) => walk(v, source, capturedAt));
}
for (const [file, source, date] of [
  [
    "next-data.json",
    "https://web.archive.org/web/20230501061119/https://www.sound.xyz/",
    "2023-05-01",
  ],
  [
    "playlist-data.json",
    "https://web.archive.org/web/20230120200848/https://www.sound.xyz/playlist/04150d7a-d471-48de-a144-54b00474e59f",
    "2023-01-20",
  ],
])
  walk(
    JSON.parse(await readFile("evidence/sound-wayback/" + file)),
    source,
    date,
  );
await writeFile(
  "data/historical-profiles.json",
  JSON.stringify([...profiles.values()], null, 2) + "\n",
);
console.log(
  profiles.size,
  "wallet-linked archived profiles",
  [...profiles.values()].filter((p) => p.avatarURL).length,
  "avatar URLs",
);
