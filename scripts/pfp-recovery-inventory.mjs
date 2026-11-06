import { writeFile } from "node:fs/promises";
import { nftCatalog as records } from "../src/nft-catalog.js";
import { people as rawPeople, sources } from "../src/data.js";
import { portraits } from "../src/portraits.js";
import { existsSync } from "node:fs";
const people = rawPeople.map((p) => ({
  ...p,
  portrait:
    portraits[p.id] &&
    [
      `public/people/${p.id}-160.webp`,
      `public/people/${p.id}-640.webp`,
      `public/media/${portraits[p.id].file}-480.webp`,
      `public/people/${p.id}-source.jpg`,
    ].some((x) => existsSync(x)),
  sources: (p.sources || []).map((id) => sources[id]).filter(Boolean),
}));
const missing = people
  .filter((p) => !p.portrait)
  .map((p) => ({
    id: p.id,
    name: p.name,
    recordCount: records.filter(
      (r) => r.artistId === p.id || r.personIds?.includes(p.id),
    ).length,
    knownLinks: p.links,
    sources: p.sources,
    releaseURLs: [
      ...new Set(
        records
          .filter((r) => r.artistId === p.id)
          .map((r) => r.originalRelease)
          .filter(Boolean),
      ),
    ],
    status: "No sourced local portrait",
    next: "Check archived Sound profile tied to exact release handle, then official artist site/press kit. Link wallet ENS only with independently established artist wallet.",
  }))
  .filter((p) => p.recordCount)
  .sort((a, b) => b.recordCount - a.recordCount);
await writeFile(
  "data/pfp-recovery-queue.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), missing }, null, 2) +
    "\n",
);
console.log(
  missing.length,
  "artist/collaborator portrait gaps with catalog recordings",
);
