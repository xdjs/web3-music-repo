import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const profiles = new Map(
  JSON.parse(readFileSync("data/historical-profiles.json")).map((p) => [
    p.address,
    p,
  ]),
);
const artists = new Map();
for (const f of readdirSync("evidence/sound-wayback/monthly").sort()) {
  const ts = f.slice(0, 14),
    capturedAt = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`,
    source = `https://web.archive.org/web/${ts}/https://www.sound.xyz/`;
  const d = JSON.parse(readFileSync("evidence/sound-wayback/monthly/" + f))
    .props?.pageProps?.initialApolloState;
  if (!d) continue;
  for (const a of Object.values(d)) {
    if (a.__typename !== "Artist" || !a.name || !a.soundHandle) continue;
    const user = d[a.user?.__ref];
    if (!/^0x[0-9a-f]{40}$/i.test(user?.publicAddress || "")) continue;
    const address = user.publicAddress.toLowerCase(),
      avatar = d[user.avatar?.__ref]?.url;
    let avatarURL = null;
    try {
      const u = new URL(avatar);
      if (
        u.protocol === "https:" &&
        u.hostname === "d2i9ybouka0ieh.cloudfront.net"
      )
        avatarURL = u.href;
    } catch {}
    if (!profiles.has(address))
      profiles.set(address, {
        address,
        name: a.name,
        soundURL: "https://www.sound.xyz/" + a.soundHandle,
        avatarURL,
        capturedAt,
        source,
        artistRole: true,
      });
    const links = [];
    if (/^[a-z0-9_]{1,15}$/i.test(user.twitterHandle || ""))
      links.push({
        label: "Archived Twitter",
        url: "https://twitter.com/" + user.twitterHandle,
        source,
        capturedAt,
      });
    artists.set(a.soundHandle, {
      name: a.name,
      soundHandle: a.soundHandle,
      address,
      links: links.length ? links : artists.get(a.soundHandle)?.links || [],
      capturedAt,
      source,
    });
  }
}
writeFileSync(
  "data/historical-artists.json",
  JSON.stringify([...artists.values()], null, 2),
);
writeFileSync(
  "data/historical-profiles.json",
  JSON.stringify([...profiles.values()], null, 2),
);
console.log(
  "ARCHIVED ARTISTS",
  artists.size,
  "with socials",
  [...artists.values()].filter((a) => a.links.length).length,
  "profiles",
  profiles.size,
);
