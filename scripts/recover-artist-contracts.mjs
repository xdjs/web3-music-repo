import fs from "node:fs/promises";
import { readNFT } from "../src/nft-reader.mjs";
const inventory = JSON.parse(await fs.readFile("data/sound-v0-1-index.json"));
const wanted = /^(Jamee Cornelia|Dot|MoRuf|Daniel Allan|oshi)$/i;
const report = { checkedAt: new Date().toISOString(), records: [], gaps: [] };
async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(18000) });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return r.json();
}
for (const c of inventory.collections.filter((c) =>
  wanted.test(c.artistName),
)) {
  try {
    const d = await json(
      `https://eth.blockscout.com/api/v2/tokens/${c.contract}/instances`,
    );
    const seen = new Set();
    for (const i of d.items || []) {
      const m = i.metadata;
      if (!m?.animation_url) continue;
      const title = m.name.replace(/\s*#\d+$/, "");
      if (seen.has(title)) continue;
      seen.add(title);
      const ref = {
        chainId: 1,
        contract: c.contract,
        tokenId: String(i.id),
        kind: "audio",
      };
      const r = await readNFT(ref);
      if (r.status !== "live") {
        report.gaps.push({
          artist: c.artistName,
          title,
          reason: "Live token read unavailable",
        });
        continue;
      }
      report.records.push({
        ...ref,
        id: `recovery-${c.contract.slice(2)}-${i.id}`,
        artist: r.artist || c.artistName,
        title,
        imageURI: r.imageURI,
        platform: "Sound",
        collection: title,
        originalRelease: m.external_url,
        note: "Recovered from Sound factory inventory and original token metadata; one representative edition per discovered release.",
        discovery: `https://eth.blockscout.com/tx/${c.transaction}`,
        checkedBlock: r.blockNumber,
        checkedAt: r.checkedAt,
      });
      console.log(c.artistName, title, r.mediaURL);
    }
    if (d.next_page_params)
      report.gaps.push({
        artist: c.artistName,
        reason: "Further edition pages remain; not an exhaustive discography",
      });
  } catch (e) {
    report.gaps.push({ artist: c.artistName, reason: e.message });
  }
  await fs.writeFile(
    "data/artist-recovery-2026-11-05.json",
    JSON.stringify(report, null, 2),
  );
}
