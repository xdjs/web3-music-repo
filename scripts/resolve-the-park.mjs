import { readFile, writeFile } from "node:fs/promises";
import { readNFT } from "../src/nft-reader.mjs";
const inventory = JSON.parse(
  await readFile(
    new URL("../data/the-park-site-inventory.json", import.meta.url),
  ),
);
const records = [],
  results = [];
const chains = { ETHEREUM: 1, BASE: 8453, ZORA: 7777777 };
for (const entry of inventory.records) {
  if (!entry.tokenId) {
    results.push({
      title: entry.title,
      status: "needs-token-or-media-identification",
      source: entry.evidenceURL,
    });
    continue;
  }
  const record = {
    id: "park-" + entry.id,
    artistId: "the-park",
    artist:
      (entry.artists || [])
        .map((a) => a.artist?.name)
        .filter(Boolean)
        .join(", ") || "The Park",
    title: entry.title,
    chainId: chains[entry.chain],
    contract: entry.contractAddress,
    tokenId: String(entry.tokenId),
    standard: entry.platform === "ZORA" ? "ERC1155" : "ERC721",
    kind: entry.mediaType === "VIDEO" ? "video" : "audio",
    platform:
      entry.platform === "SOUND_XYZ"
        ? "Sound"
        : entry.platform === "CATALOG"
          ? "Catalog"
          : "Zora",
    collection: entry.title,
    note: entry.description || "From The Park’s own works archive.",
    discovery: entry.evidenceURL,
    originalRelease: entry.evidenceURL,
  };
  let resolved = await readNFT(record);
  if (resolved.status !== "live" && record.standard === "ERC1155") {
    record.standard = "ERC721";
    resolved = await readNFT(record);
  }
  results.push({
    title: entry.title,
    status: resolved.status,
    source: entry.evidenceURL,
  });
  if (resolved.status === "live")
    records.push({
      ...record,
      imageURI: resolved.imageURI || resolved.imageURL,
      checkedBlock: resolved.blockNumber,
      checkedAt: resolved.checkedAt,
    });
  console.log(entry.title, resolved.status);
  await writeFile(
    new URL("../src/park-import.js", import.meta.url),
    `// Verified token metadata from The Park's public works archive.\nexport const parkImport = ${JSON.stringify(records, null, 2)};\n`,
  );
  await writeFile(
    new URL("../data/the-park-resolution.json", import.meta.url),
    JSON.stringify(results, null, 2),
  );
}
