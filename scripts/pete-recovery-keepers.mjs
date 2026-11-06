import { readFileSync, writeFileSync } from "node:fs";
import { decodeAbiParameters } from "viem";
const c = JSON.parse(
  readFileSync("data/pete-recovery/zora-collection-reads.json"),
).collections.find((x) => x.chainId === 8453);
const requests = Array.from({ length: 16 }, (_, i) => ({
  jsonrpc: "2.0",
  id: i,
  method: "eth_call",
  params: [
    { to: c.contract, data: "0xc87b56dd" + i.toString(16).padStart(64, "0") },
    c.block,
  ],
}));
const res = await fetch(c.rpc, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(requests),
  signal: AbortSignal.timeout(20000),
});
const responses = await res.json();
writeFileSync(
  "data/pete-recovery/keepers-token-reads.json",
  JSON.stringify(
    {
      contract: c.contract,
      chainId: 8453,
      block: c.block,
      requests,
      responses,
    },
    null,
    2,
  ),
);
const out = [];
if (Array.isArray(responses))
  for (const r of responses) {
    let uri;
    try {
      uri = decodeAbiParameters([{ type: "string" }], r.result)[0];
    } catch {
      continue;
    }
    let metadata = null,
      error = null;
    try {
      const response = await fetch(
        uri.replace("ipfs://", "https://magic.decentralized-content.com/ipfs/"),
        { signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) throw Error("HTTP " + response.status);
      metadata = await response.json();
    } catch (e) {
      error = e.message;
    }
    out.push({ tokenId: String(r.id), uri, metadata, error });
    console.log(
      r.id,
      metadata?.name,
      metadata?.animation_url || "no animation",
      error || "",
    );
    writeFileSync(
      "data/pete-recovery/keepers-metadata.json",
      JSON.stringify(out, null, 2),
    );
  }
