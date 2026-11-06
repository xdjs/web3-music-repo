import { readFileSync, writeFileSync } from "node:fs";
import { decodeAbiParameters } from "viem";
const input = JSON.parse(readFileSync("work/pete-zora-browser.json"));
const response = input.responses.find(
  (r) => r.body?.data?.profile?.profileZoraPosts?.edges,
);
const profile = response.body.data.profile;
writeFileSync(
  "data/pete-recovery/zora-creator-feed.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      source: "https://zora.co/@p3t3rango",
      request: JSON.parse(response.request),
      profile,
    },
    null,
    2,
  ),
);
const nodes = profile.profileZoraPosts.edges
  .map((x) => x.node)
  .filter((x) => x.__typename === "GraphQLZora721Collection");
const out = [];
for (const n of nodes) {
  const rpc =
    n.chainId === 1
      ? "https://ethereum-rpc.publicnode.com"
      : "https://base-rpc.publicnode.com";
  const call = async (method, params) => {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(12000),
    });
    return r.json();
  };
  const block = await call("eth_blockNumber", []);
  const calls = [];
  for (const [name, data, type] of [
    ["name", "0x06fdde03", "string"],
    ["owner", "0x8da5cb5b", "address"],
    ["totalSupply", "0x18160ddd", "uint256"],
    ["supports721", "0x01ffc9a780ac58cd" + "0".repeat(56), "bool"],
    ["tokenURI1", "0xc87b56dd" + "1".padStart(64, "0"), "string"],
  ]) {
    try {
      const response = await call("eth_call", [
        { to: n.address, data },
        block.result,
      ]);
      let decoded = null;
      try {
        decoded = decodeAbiParameters([{ type }], response.result)[0];
        if (typeof decoded === "bigint") decoded = decoded.toString();
      } catch {}
      calls.push({ name, data, response, decoded });
    } catch (e) {
      calls.push({ name, error: e.message });
    }
  }
  const row = {
    chainId: n.chainId,
    contract: n.address,
    creatorProfile: n.creatorProfile,
    media: n.mediaContent,
    rpc,
    block: block.result,
    calls,
  };
  out.push(row);
  console.log(
    JSON.stringify({
      contract: n.address,
      calls: calls.map((x) => [x.name, x.decoded || x.error]),
    }),
  );
  writeFileSync(
    "data/pete-recovery/zora-collection-reads.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), collections: out },
      null,
      2,
    ),
  );
}
