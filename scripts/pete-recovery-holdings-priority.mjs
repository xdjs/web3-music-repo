import { readFileSync, writeFileSync } from "node:fs";
import { decodeAbiParameters } from "viem";
const items = JSON.parse(
  readFileSync("work/pete-opensea/priority.json"),
).filter((x) => /DEMO|Say it celly/.test(x.name));
const out = [];
for (const x of items) {
  const rpc = "https://ethereum-rpc.publicnode.com";
  const rpcCall = async (method, params) =>
    (
      await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(12000),
      })
    ).json();
  const block = await rpcCall("eth_blockNumber", []);
  const reads = [];
  for (const [name, data, type] of [
    [
      "tokenURI",
      "0xc87b56dd" + BigInt(x.tokenId).toString(16).padStart(64, "0"),
      "string",
    ],
    ["owner", "0x8da5cb5b", "address"],
    ["supports721", "0x01ffc9a780ac58cd" + "0".repeat(56), "bool"],
  ]) {
    const response = await rpcCall("eth_call", [
      { to: x.contractAddress, data },
      block.result,
    ]);
    let decoded = null;
    try {
      decoded = decodeAbiParameters([{ type }], response.result)[0];
    } catch {}
    reads.push({ name, data, response, decoded });
  }
  const uri = reads.find((x) => x.name === "tokenURI").decoded;
  let metadata = null,
    error = null;
  try {
    if (uri.startsWith("data:"))
      metadata = JSON.parse(
        Buffer.from(uri.split(",")[1], "base64").toString(),
      );
    else {
      const url = uri.includes("/ipfs/")
        ? "https://magic.decentralized-content.com/ipfs/" +
          uri.split("/ipfs/")[1]
        : uri.replace(
            "ipfs://",
            "https://magic.decentralized-content.com/ipfs/",
          );
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw Error("HTTP " + r.status);
      metadata = await r.json();
    }
  } catch (e) {
    error = e.message;
  }
  out.push({
    item: x,
    chainId: 1,
    rpc,
    block: block.result,
    reads,
    metadata,
    error,
  });
  writeFileSync(
    "data/pete-recovery/holdings-priority-reads.json",
    JSON.stringify(out, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        name: x.name,
        reads: reads.map((x) => [
          x.name,
          x.name === "tokenURI" ? x.decoded?.slice(0, 100) : x.decoded,
        ]),
        metadata,
        error,
      },
      null,
      2,
    ),
  );
}
