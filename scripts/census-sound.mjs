import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decodeEventLog, parseAbiItem, toEventSelector } from "viem";
import { soundDeployments, decodeFactoryEvent } from "./sound-contracts.mjs";
const chains = {
  1: {
    rpc: "https://ethereum-rpc.publicnode.com",
    index: "eth.blockscout.com",
  },
  10: {
    rpc: "https://optimism-rpc.publicnode.com",
    index: "optimism.blockscout.com",
  },
  8453: {
    rpc: "https://base-rpc.publicnode.com",
    index: "base.blockscout.com",
  },
  7777777: { rpc: "https://rpc.zora.energy", index: "explorer.zora.energy" },
  42161: {
    rpc: "https://arbitrum-one-rpc.publicnode.com",
    index: "arbitrum.blockscout.com",
  },
  137: {
    rpc: "https://polygon-bor-rpc.publicnode.com",
    index: "polygon.blockscout.com",
  },
};
const eventABI = {
  0: parseAbiItem(
    "event CreatedArtist(uint256 artistId,string name,string symbol,address indexed artistAddress)",
  ),
  1: parseAbiItem(
    "event SoundEditionCreated(address indexed soundEdition,address indexed deployer,bytes initData,address[] contracts,bytes[] data,bytes[] results)",
  ),
  2: parseAbiItem(
    "event Created(address indexed implementation,address indexed edition,address indexed owner,bytes initData,address[] contracts,bytes[] data,bytes[] results)",
  ),
};
const hex = (n) => "0x" + n.toString(16);
const sha = (x) => createHash("sha256").update(x).digest("hex");
async function rpc(chainId, method, params) {
  const r = await fetch(chains[chainId].rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error("RPC HTTP " + r.status);
  const d = await r.json();
  if (d.error) throw Error(d.error.message);
  return d.result;
}
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (r.ok) return r.json();
    if (![429, 500, 502, 503, 504].includes(r.status))
      throw Error("HTTP " + r.status);
    await new Promise((r) => setTimeout(r, Math.min(15000, 1500 * 2 ** i)));
  }
  throw Error("Indexer retries exhausted");
}
await mkdir("data/census", { recursive: true });
const manifest = {
  startedAt: new Date().toISOString(),
  sources: [
    {
      repo: "https://github.com/soundxyz/sound-protocol",
      commit: "cd04022e178d071c3e86d201106335bc960161c4",
    },
    {
      repo: "https://github.com/soundxyz/protocol",
      commit: "c6cdc7bf7eb00f661f0a44a755b62beb78c531fe",
    },
  ],
  scope:
    "Known official factories plus canonical-address probes; public index pagination, not a proof that no unknown factory exists",
  probes: [],
  factories: [],
};
for (const [cid, c] of Object.entries(chains)) {
  try {
    const chainId = Number(cid),
      block = parseInt(await rpc(chainId, "eth_blockNumber", []), 16);
    for (const factory of [
      ...new Set(Object.values(soundDeployments).map((d) => d.factory)),
    ]) {
      const code = await rpc(chainId, "eth_getCode", [factory, hex(block)]);
      const p = {
        chainId,
        factory,
        block,
        codePresent: code !== "0x",
        codeSha256: code !== "0x" ? sha(code) : null,
        checkedAt: new Date().toISOString(),
      };
      manifest.probes.push(p);
      console.log("PROBE", chainId, factory, p.codePresent);
    }
  } catch (e) {
    manifest.probes.push({
      chainId: Number(cid),
      status: "unavailable",
      error: e.message,
    });
  }
  await writeFile(
    "data/census/manifest.json",
    JSON.stringify(manifest, null, 2),
  );
}
const scopes = Object.entries(soundDeployments).map(([key, d]) => ({
  key,
  version: Number(key.split(":")[0]),
  chainId: Number(key.split(":")[1]),
  ...d,
}));
// Extra-chain code is a lead only until source/event verification; never silently declare it Sound.
for (const chainId of [1, 10]) {
  for (const scope of scopes.filter((s) => s.chainId === chainId)) {
    const { key, version, factory, topic } = scope;
    if (toEventSelector(eventABI[version]) !== topic)
      throw Error("Source event hash mismatch");
    const file = `data/census/${key.replace(":", "-")}.json`;
    let state;
    try {
      state = JSON.parse(await readFile(file));
    } catch {}
    const pinned = manifest.probes.find(
      (p) => p.chainId === chainId && p.factory === factory,
    );
    state ||= {
      ...scope,
      toBlock: pinned?.block,
      startedAt: new Date().toISOString(),
      cursor: null,
      complete: false,
      collections: [],
      pages: [],
    };
    if (state.factory !== factory || state.version !== version)
      throw Error("Bad checkpoint");
    const seen = new Set(state.collections.map((c) => c.contract));
    try {
      while (!state.complete) {
        const url = `https://${chains[chainId].index}/api/v2/addresses/${factory}/logs${state.cursor ? "?" + new URLSearchParams(state.cursor) : ""}`;
        const d = await get(url);
        if (!Array.isArray(d.items)) throw Error("Invalid index page");
        for (const event of d.items) {
          if (event.block_number > state.toBlock) continue;
          const collection = decodeFactoryEvent(event, scope);
          if (!collection || seen.has(collection.contract)) continue;
          const decoded = decodeEventLog({
            abi: [eventABI[version]],
            data: event.data,
            topics: event.topics,
            strict: true,
          });
          Object.assign(
            collection,
            version === 0
              ? { artistName: decoded.args.name }
              : {
                  creator: decoded.args.owner || decoded.args.deployer,
                  implementation: decoded.args.implementation || null,
                },
          );
          state.collections.push(collection);
          seen.add(collection.contract);
        }
        const next = d.next_page_params || null;
        if (next && JSON.stringify(next) === JSON.stringify(state.cursor))
          throw Error("Repeated pagination cursor");
        state.pages.push({
          url,
          itemCount: d.items.length,
          sha256: sha(JSON.stringify(d)),
          nextCursor: next,
          checkedAt: new Date().toISOString(),
        });
        state.cursor = next;
        state.complete = !next;
        state.checkedAt = new Date().toISOString();
        delete state.error;
        await writeFile(file, JSON.stringify(state, null, 2));
        if (state.pages.length % 10 === 0 || state.complete)
          console.log(
            "CENSUS",
            key,
            state.collections.length,
            "pages",
            state.pages.length,
            "complete",
            state.complete,
          );
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch (e) {
      state.error = e.message;
      await writeFile(file, JSON.stringify(state, null, 2));
      console.log("CENSUS RETRY NEEDED", key, e.message);
    }
    manifest.factories.push({
      key,
      chainId,
      version,
      factory,
      toBlock: state.toBlock,
      contracts: state.collections.length,
      pages: state.pages.length,
      complete: state.complete,
      error: state.error,
      checkedAt: state.checkedAt,
      file,
    });
    await writeFile(
      "data/census/manifest.json",
      JSON.stringify(manifest, null, 2),
    );
  }
}
manifest.finishedAt = new Date().toISOString();
await writeFile("data/census/manifest.json", JSON.stringify(manifest, null, 2));
console.log(
  "FINISHED CENSUS",
  manifest.factories.map((f) => [f.key, f.contracts, f.complete]),
);
