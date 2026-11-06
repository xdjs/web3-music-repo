import { readFileSync, writeFileSync } from "node:fs";
const collections = JSON.parse(
  readFileSync("data/pete-recovery/zora-collection-reads.json"),
).collections;
const metadata = JSON.parse(
  readFileSync("data/pete-recovery/zora-original-metadata.json"),
);
const playback = JSON.parse(
  readFileSync("data/pete-recovery/zora-media-verification.json"),
).results;
const bundle = {
  scope:
    "Four verified additional Pete Rango Zora releases; selected token references, not complete discography or all editions.",
  records: [],
  evidence: {},
  proposedPeople: [
    {
      id: "xmane",
      name: "Xmane",
      role: "Producer and creative director",
      bio: "Credited with Pete Rango for creative direction and production in the original Savage Planet token metadata.",
    },
    {
      id: "nawt-creative",
      name: "Nawt Creative",
      role: "3D animation",
      bio: "Credited for 3D animation in the original Savage Planet token metadata.",
    },
  ],
};
for (const c of collections) {
  const v = playback.find((x) => x.contract === c.contract);
  if (v?.status !== "played" || !(v.audioDecodedBytes > 0)) continue;
  const m = metadata[c.contract];
  const name = c.calls.find((x) => x.name === "name").decoded.trim();
  const uri = c.calls.find((x) => x.name === "tokenURI1").decoded;
  const id = `pete-zora-${c.chainId}-${c.contract.slice(2)}-1`;
  const savage =
    /Creative Direction and Production by Xmane and Pete Rango/.test(
      m.description,
    );
  const source = `https://etherscan.io/token/${c.contract}?a=1`;
  const kind = v.videoWidth ? "video" : "audio";
  const credits = savage
    ? [
        {
          personId: "pete-rango",
          role: "Creative direction and production",
          source,
        },
        {
          personId: "xmane",
          role: "Creative direction and production",
          source,
        },
        { personId: "nawt-creative", role: "3D animation", source },
      ]
    : [];
  bundle.records.push({
    id,
    title: name,
    artist: savage ? "Xmane & Pete Rango" : "Pete Rango",
    chainId: c.chainId,
    contract: c.contract,
    tokenId: "1",
    standard: "ERC721",
    platform: "Zora",
    kind,
    collection: savage ? "Savage Planet" : name,
    imageURI: m.image,
    durationSeconds: v.duration,
    creator: c.calls.find((x) => x.name === "owner").decoded,
    personIds: savage
      ? ["pete-rango", "xmane", "nawt-creative"]
      : ["pete-rango"],
    credits,
    note: m.description,
    originalRelease: `https://zora.co/collect/eth:${c.contract}/1`,
    playback: { status: "played", checkedAt: v.checkedAt, workingURL: v.url },
    discovery:
      "Zora p3t3rango created-collection feed, fixed-block ERC721 reads, original token metadata and actual decoded audio/video playback",
  });
  bundle.evidence[id] = {
    status: "live",
    chainId: c.chainId,
    contract: c.contract,
    tokenId: "1",
    standard: "ERC721",
    blockNumber: parseInt(c.block, 16),
    checkedAt: v.checkedAt,
    title: name,
    artist: savage ? "Xmane & Pete Rango" : "Pete Rango",
    kind,
    imageURI: m.image,
    imageURL: m.image.replace(
      "ipfs://",
      "https://magic.decentralized-content.com/ipfs/",
    ),
    mediaURI: m.animation_url,
    mediaURL: v.url,
    metadataURI: uri,
    metadataURL: null,
    metadataLocation:
      "ERC721 tokenURI(1) → JSON returned directly by contract → original IPFS audio/video",
    durationSeconds: v.duration,
  };
}
writeFileSync(
  "data/pete-recovery/zora-recovered-media.json",
  JSON.stringify(bundle, null, 2) + "\n",
);
console.log(
  bundle.records.map((r) => [r.id, r.title, r.kind, r.durationSeconds]),
);
