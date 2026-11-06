import { readFileSync, writeFileSync } from "node:fs";
const file = "data/pete-recovery/zora-recovered-media.json",
  bundle = JSON.parse(readFileSync(file));
const reads = JSON.parse(
  readFileSync("data/pete-recovery/holdings-priority-reads.json"),
);
const plays = JSON.parse(
  readFileSync("data/pete-recovery/holdings-media-verification.json"),
).results;
for (const x of reads) {
  const v = plays.find(
    (v) =>
      v.contract === x.item.contractAddress && v.tokenId === x.item.tokenId,
  );
  if (
    v?.status !== "played" ||
    v.audioDecodedBytes <= 0 ||
    !x.reads.find((x) => x.name === "supports721")?.decoded
  )
    throw Error("Unverified input");
  const evermore = x.metadata.name.includes("Evermore");
  const id = `pete-zora-1-${x.item.contractAddress.slice(2)}-${x.item.tokenId}`;
  const uri = x.reads.find((x) => x.name === "tokenURI").decoded;
  const source = `https://etherscan.io/token/${x.item.contractAddress}?a=${x.item.tokenId}`;
  const artist = evermore ? "REIN & Pete Rango" : "Mavi Taylor";
  const title = evermore
    ? "Evermore DEMO Tape REIN X Pete Rango"
    : "Say it celly";
  const credits = evermore
    ? [
        {
          personId: "pete-rango",
          role: "Collaboration (named in original release title)",
          source,
        },
      ]
    : [
        { personId: "pete-rango", role: "Producer", source },
        { personId: "nawt-creative", role: "Artwork", source },
      ];
  const record = {
    id,
    title,
    artist,
    chainId: 1,
    contract: x.item.contractAddress,
    tokenId: x.item.tokenId,
    standard: "ERC721",
    platform: evermore ? "Other" : "Zora",
    kind: "audio",
    collection: evermore
      ? "Evermore DEMO Tape REIN X Pete Rango"
      : "Say it celly",
    imageURI: x.metadata.image,
    durationSeconds: v.duration,
    creator: x.reads.find((x) => x.name === "owner").decoded,
    credits,
    personIds: ["pete-rango"],
    note: x.metadata.description,
    originalRelease: evermore
      ? `https://opensea.io/assets/ethereum/${x.item.contractAddress}/${x.item.tokenId}`
      : `https://zora.co/collect/eth:${x.item.contractAddress}/${x.item.tokenId}`,
    discovery: evermore
      ? "Public OpenSea holdings identified token; fixed-block tokenURI original metadata explicitly names REIN X Pete Rango. Minting platform not yet independently established."
      : "Public OpenSea holdings identified token; fixed-block tokenURI original metadata proves media and credits. Exact contract appears in Mavi Taylor Zora created feed.",
    playback: {
      status: "played",
      checkedAt: v.checkedAt,
      workingURL: v.workingURL,
    },
  };
  bundle.records = bundle.records.filter((r) => r.id !== id);
  bundle.records.push(record);
  bundle.evidence[id] = {
    ...bundle.evidence[id],
    status: "live",
    chainId: 1,
    contract: record.contract,
    tokenId: record.tokenId,
    standard: "ERC721",
    blockNumber: parseInt(x.block, 16),
    checkedAt: v.checkedAt,
    title,
    artist,
    kind: "audio",
    imageURI: x.metadata.image,
    imageURL: x.metadata.image.replace(
      "ipfs://",
      "https://magic.decentralized-content.com/ipfs/",
    ),
    mediaURI: x.metadata.animation_url,
    mediaURL: v.workingURL,
    metadataURI: uri,
    metadataURL: uri.startsWith("data:")
      ? null
      : uri.replace("ipfs://", "https://ipfs.filebase.io/ipfs/"),
    metadataLocation: uri.startsWith("data:")
      ? "ERC721 tokenURI → original JSON onchain → original IPFS audio"
      : "ERC721 tokenURI → original IPFS JSON → original IPFS audio",
    durationSeconds: v.duration,
  };
}
bundle.scope =
  "Six verified additional Pete Rango music releases discovered through Zora creator profiles and public OpenSea holdings; not complete discography or all editions.";
writeFileSync(file, JSON.stringify(bundle, null, 2) + "\n");
console.log(bundle.records.map((x) => [x.title, x.artist]));
