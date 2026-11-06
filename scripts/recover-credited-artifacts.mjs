import fs from "node:fs/promises";
import { readNFT } from "../src/nft-reader.mjs";
const credits = [
  [
    "0xcA47FbD3441b1eBb64c8D51032C469978ACcd376",
    "Jon Waltz, Jamee Cornelia, Jadyn Violet",
    "SKYZONE",
    "Written by Jon Waltz, Jamee Cornelia and Jadyn Violet; produced by 4km. Credits follow the original edition description.",
  ],
  [
    "0x19Ed8B4f86f451FEB79BfF0Fc676AcA30c1B8129",
    "Jamee Cornelia",
    "Dizzy (Zoratopia Miami ’22)",
    "Jamee Cornelia performing at Art N Folly Gallery, December 3, 2022. Shot by Terrance T Young, Jahmel Reynolds and Mariana Makwaia; edited by Terrance T Young and Jahmel Reynolds. Credits and date follow the original NFT description.",
  ],
  [
    "0x5351A2E2a5BD6fbB0be3f5d2bf02D444eF1E2BA1",
    "Cam Murdoch, J Burn, Bongdoe",
    "SONATA",
    "An audio/visual collaboration: rappers Cam Murdoch and J Burn, and artist Bongdoe, as credited by the original edition.",
  ],
  [
    "0x59B748ac036Dec64362d695A0514C02B609B1b9B",
    "Cam Murdoch",
    "Love U Down (Zoratopia Miami ’22)",
    "Cam Murdoch performing at Art N Folly Gallery, December 3, 2022. Videography by Terrance T Young, Jahmel Reynolds and Mariana Makwaia; edited by Nic Jara and Jahmel Reynolds. Credits and date follow the original NFT description.",
  ],
];
const out = [];
for (const [contract, artist, title, note] of credits) {
  const d = await (
    await fetch(
      `https://eth.blockscout.com/api/v2/tokens/${contract}/instances`,
    )
  ).json();
  const i = d.items.find((i) => i.metadata?.animation_url);
  const ref = { chainId: 1, contract, tokenId: String(i.id) };
  const r = await readNFT(ref);
  if (r.status !== "live") {
    console.log("unavailable", title);
    continue;
  }
  const h = await fetch(r.mediaURL, {
    method: "HEAD",
    signal: AbortSignal.timeout(12000),
  });
  const type = h.headers.get("content-type") || "";
  if (!/^(audio|video)\//.test(type)) continue;
  out.push({
    ...ref,
    id: `recovery-${contract.slice(2).toLowerCase()}-${i.id}`,
    artist,
    title,
    note,
    kind: type.startsWith("video/") ? "video" : "audio",
    imageURI: r.imageURI,
    platform: "Other",
    collection: title,
    discovery: `https://eth.blockscout.com/token/${contract}?a=${i.id}`,
    checkedAt: r.checkedAt,
    checkedBlock: r.blockNumber,
  });
  console.log("verified", title, type);
  await fs.writeFile(
    "data/artist-credited-recovery.json",
    JSON.stringify(out, null, 2),
  );
}
