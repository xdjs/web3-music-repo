import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const profiles = new Map(
  JSON.parse(readFileSync("data/historical-profiles.json")).map((p) => [
    p.address,
    p,
  ]),
);
for (const f of readdirSync("evidence/sound-wayback/monthly")) {
  const ts = f.slice(0, 14),
    capturedAt = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`,
    source = `https://web.archive.org/web/${ts}/https://www.sound.xyz/`;
  function walk(x) {
    if (!x || typeof x !== "object") return;
    if (
      /^0x[0-9a-f]{40}$/i.test(x.ownerPublicAddress) &&
      typeof x.ownerUsername === "string"
    ) {
      const address = x.ownerPublicAddress.toLowerCase(),
        prior = profiles.get(address);
      let avatarURL = null;
      try {
        const u = new URL(x.avatarUrl);
        if (
          u.protocol === "https:" &&
          u.hostname === "d2i9ybouka0ieh.cloudfront.net"
        )
          avatarURL = u.href;
      } catch {}
      if (
        !prior ||
        (avatarURL && (!prior.avatarURL || capturedAt > prior.capturedAt))
      )
        profiles.set(address, {
          address,
          name: x.ownerUsername,
          soundURL: x.ownerWebappUri?.startsWith("https://www.sound.xyz/")
            ? x.ownerWebappUri
            : null,
          avatarURL,
          capturedAt,
          source,
          ...(prior?.avatarURL === avatarURL && prior.localAvatar
            ? {
                localAvatar: prior.localAvatar,
                avatarRetrievedAt: prior.avatarRetrievedAt,
              }
            : {}),
        });
    }
    Object.values(x).forEach(walk);
  }
  walk(JSON.parse(readFileSync("evidence/sound-wayback/monthly/" + f)));
}
writeFileSync(
  "data/historical-profiles.json",
  JSON.stringify([...profiles.values()], null, 2),
);
console.log("Profiles", profiles.size);
