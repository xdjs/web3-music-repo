import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  MINT_SONGS_V2,
  mintSongsIPFS,
  mintSongsTokenURI,
} from "../src/mint-songs.mjs";
const file = "data/mint-songs/live-verification.json";
const bundle = JSON.parse(readFileSync("data/mint-songs/archived-media.json"));
const originals = JSON.parse(
  readFileSync("data/mint-songs/original-metadata.json"),
);
let output;
try {
  output = JSON.parse(readFileSync(file));
} catch {
  output = { records: {} };
}
const limit = Number(
  process.argv.find((x) => x.startsWith("--limit="))?.slice(8) || 3,
);
if (!Number.isInteger(limit) || limit < 1 || limit > 143)
  throw Error("--limit must be 1–143");
const rpcURL = "https://ethereum-rpc.publicnode.com";
async function rpc(method, params) {
  const response = await fetch(rpcURL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`RPC HTTP ${response.status}`);
  const result = await response.json();
  if (result.error || !result.result)
    throw Error(result.error?.message || "Missing RPC result");
  return result.result;
}
async function metadataJSON(uri) {
  const response = await fetch(
    `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`,
    { redirect: "error", signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok) throw Error(`Metadata HTTP ${response.status}`);
  let bytes = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > 1048576) throw Error("Metadata exceeds 1 MB");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
if ((await rpc("eth_chainId", [])) !== "0x1") throw Error("Wrong chain");
const block = await rpc("eth_blockNumber", []);
const name = mintSongsTokenURI(
  await rpc("eth_call", [{ to: MINT_SONGS_V2, data: "0x06fdde03" }, block]),
);
if (name !== "MintSongsV2") throw Error("Unexpected contract name");
output.contract = {
  chainId: 1,
  address: MINT_SONGS_V2,
  name,
  checkedAt: new Date().toISOString(),
  referenceBlock: Number(BigInt(block)),
};
let count = 0;
for (const record of bundle.records) {
  if (count >= limit) break;
  if (
    output.records[record.id]?.status === "metadata-verified" &&
    !process.argv.includes("--refresh")
  )
    continue;
  count++;
  const check = {
    checkedAt: new Date().toISOString(),
    referenceBlock: Number(BigInt(block)),
    playbackVerified: false,
  };
  try {
    check.tokenURIRaw = mintSongsTokenURI(
      await rpc("eth_call", [
        {
          to: MINT_SONGS_V2,
          data: `0xc87b56dd${BigInt(record.tokenId).toString(16).padStart(64, "0")}`,
        },
        block,
      ]),
    );
    check.metadataURI = mintSongsIPFS(check.tokenURIRaw);
    if (check.metadataURI !== bundle.evidence[record.id].metadataURI)
      throw Error("Current token URI differs from snapshot");
    const current = await metadataJSON(check.metadataURI);
    check.matchesSnapshot = isDeepStrictEqual(
      current,
      originals[record.id].results,
    );
    if (!check.matchesSnapshot)
      throw Error("Current metadata differs from snapshot");
    check.status = "metadata-verified";
  } catch (error) {
    check.status = "unresolved";
    check.reason = error.message;
    check.retryable = !/differs/.test(error.message);
  }
  output.records[record.id] = check;
  output.updatedAt = new Date().toISOString();
  writeFileSync(file + ".tmp", JSON.stringify(output, null, 2) + "\n");
  renameSync(file + ".tmp", file);
  console.log(record.tokenId, check.status, check.reason || "");
  await new Promise((resolve) => setTimeout(resolve, 500));
}
