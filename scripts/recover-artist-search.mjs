import fs from "node:fs/promises";
import { readNFT } from "../src/nft-reader.mjs";
const leads = JSON.parse(await fs.readFile("data/artist-recovery-search.json"));
const report = { records: [], evidence: [], gaps: [] };
for (const lead of leads)
  for (const c of (lead.items || []).filter((x) => x.type === "token")) {
    try {
      const res = await fetch(
        `https://eth.blockscout.com/api/v2/tokens/${c.address_hash}/instances`,
        { signal: AbortSignal.timeout(14000) },
      );
      if (!res.ok) throw Error(`HTTP ${res.status}`);
      const d = await res.json();
      const i = d.items?.find((i) => i.metadata?.animation_url);
      if (!i) throw Error("No indexed media metadata");
      const m = i.metadata;
      const ref = {
        chainId: 1,
        contract: c.address_hash,
        tokenId: String(i.id),
      };
      const r = await readNFT(ref);
      if (r.status !== "live") throw Error("Live token metadata unavailable");
      const media = await fetch(r.mediaURL, {
        method: "HEAD",
        signal: AbortSignal.timeout(12000),
      });
      const type = media.headers.get("content-type") || "";
      if (!/^(audio|video)\//.test(type))
        throw Error(`Media MIME not confirmed: ${media.status} ${type}`);
      const artist =
        r.artist ||
        m.properties?.artist ||
        m.attributes?.find((x) => x.trait_type === "Artist")?.value;
      report.evidence.push({
        lead: lead.name,
        contract: c.address_hash,
        metadata: m,
        mediaType: type,
        mediaStatus: media.status,
      });
      if (!artist)
        throw Error("Artist attribution needs manual metadata review");
      const title = r.title.replace(/\s*#\d+$/, "");
      report.records.push({
        ...ref,
        id: `recovery-${c.address_hash.slice(2).toLowerCase()}-${i.id}`,
        artist: String(artist),
        title,
        kind: type.startsWith("video/") ? "video" : "audio",
        imageURI: r.imageURI,
        platform: /sound.xyz/.test(m.external_url || "")
          ? "Sound"
          : /glass.xyz/.test(m.external_url || "")
            ? "Glass"
            : "Other",
        collection: c.name,
        note: "Original token metadata and media checked during the artist-coverage review.",
        discovery: `https://eth.blockscout.com/token/${c.address_hash}`,
        originalRelease: m.external_url,
        checkedBlock: r.blockNumber,
        checkedAt: r.checkedAt,
      });
      console.log("OK", lead.name, title, type);
    } catch (e) {
      report.gaps.push({
        artist: lead.name,
        contract: c.address_hash,
        title: c.name,
        reason: e.message,
      });
      console.log("GAP", c.name, e.message);
    }
    await fs.writeFile(
      "data/artist-search-recovery-2026-11-05.json",
      JSON.stringify(report, null, 2),
    );
  }
