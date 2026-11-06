import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const file = "evidence/sound-wayback/recovered-comments.json";
const comments = new Map(
  JSON.parse(readFileSync(file)).map((c) => [c.comment.id, c]),
);
for (const f of readdirSync("evidence/sound-wayback/monthly").sort()) {
  const ts = f.slice(0, 14),
    source = `https://web.archive.org/web/${ts}/https://www.sound.xyz/`;
  function walk(x) {
    if (!x || typeof x !== "object") return;
    if (x.title && x.artist && Array.isArray(x.topNftsWithComment)) {
      for (const n of x.topNftsWithComment) {
        if (
          !n.comment?.id ||
          typeof n.comment.message !== "string" ||
          !/^0x[0-9a-f]{40}$/i.test(n.ownerPublicAddress)
        )
          continue;
        if (comments.has(n.comment.id)) continue;
        comments.set(n.comment.id, {
          release: x.title,
          artist: x.artist.name || "",
          releaseId: x.id,
          nftId: n.id,
          serialNumber: n.serialNumber,
          songSlot: n.songSlot,
          ownerUsernameAtCapture: n.ownerUsername,
          ownerAddressAtCapture: n.ownerPublicAddress.toLowerCase(),
          comment: {
            ...n.comment,
            updatedAt: Number.isFinite(new Date(n.comment.updatedAt).getTime())
              ? new Date(n.comment.updatedAt).toISOString()
              : null,
          },
          source,
        });
      }
    }
    Object.values(x).forEach(walk);
  }
  walk(JSON.parse(readFileSync("evidence/sound-wayback/monthly/" + f)));
}
writeFileSync(file, JSON.stringify([...comments.values()], null, 2));
console.log(
  "Comments",
  comments.size,
  "releases",
  new Set([...comments.values()].map((c) => c.releaseId)).size,
);
