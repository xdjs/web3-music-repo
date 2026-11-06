import { readFileSync, writeFileSync } from "node:fs";
const m = JSON.parse(readFileSync("data/census/manifest.json"));
const rpcs = {
  1: "https://ethereum-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
  8453: "https://base-rpc.publicnode.com",
  137: "https://polygon-bor-rpc.publicnode.com",
};
const factory = "0x0000000000aec84f5bfc2af15eafb943bf4e3522";
const codes = {};
async function rpc(cid, method, params) {
  const d = await (
    await fetch(rpcs[cid], {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(15000),
    })
  ).json();
  if (d.error) throw Error(d.error.message);
  return d.result;
}
for (const chainId of [1, 10, 8453, 137])
  codes[chainId] = await rpc(chainId, "eth_getCode", [factory, "latest"]);
const base = Buffer.from(codes[1].slice(2), "hex");
const report = [];
for (const chainId of [10, 8453, 137]) {
  const b = Buffer.from(codes[chainId].slice(2), "hex");
  const diffs = [];
  let range = null;
  for (let i = 0; i < Math.max(base.length, b.length); i++) {
    if (base[i] !== b[i]) {
      if (range && range[1] === i - 1) range[1] = i;
      else {
        range = [i, i];
        diffs.push(range);
      }
    }
  }
  report.push({
    chainId,
    byteLength: b.length,
    ethereumByteLength: base.length,
    differingByteRanges: diffs,
    code: codes[chainId],
  });
  console.log("CODE", chainId, b.length, "diff", diffs);
}
writeFileSync(
  "data/census/crosschain-code.json",
  JSON.stringify(report, null, 2),
);
try {
  const logs = await rpc(1, "eth_getLogs", [
    {
      address: factory,
      fromBlock: "0x0",
      toBlock: "latest",
      topics: [
        "0xe94db3a31c09b7894f023c1f9114859672be916ffa8282215d7d43595bdcb3e7",
      ],
    },
  ]);
  console.log("RPC FULL LOGS", logs.length);
  writeFileSync("data/census/rpc-v2-ethereum.json", JSON.stringify(logs));
} catch (e) {
  console.log("RPC LIMIT", e.message);
}
