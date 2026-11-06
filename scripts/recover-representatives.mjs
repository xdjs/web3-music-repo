import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { toFunctionSelector } from "viem";
import { readNFT } from "../src/nft-reader.mjs";
const modern = JSON.parse(readFileSync("data/sound-expanded.json"));
const entries = ["1-1", "2-1", "1-10", "2-10"].flatMap((k) => {
  const d = JSON.parse(readFileSync("data/census/" + k + ".json"));
  return d.collections.map((c) => ({
    ...c,
    chainId: d.chainId,
    factory: d.factory,
    version: d.version,
  }));
});
const file = "data/sound-fallback.json";
let state;
try {
  state = JSON.parse(readFileSync(file));
} catch {
  state = {
    startedAt: new Date().toISOString(),
    scope:
      "Fallback token representatives and mint-state checks for failed token-one reads",
    records: [],
    evidence: {},
    attempts: {},
  };
}
const jobs = entries.filter(
  (c) =>
    modern.attempts[c.chainId + ":" + c.contract]?.status === "unavailable" &&
    !["live", "unminted"].includes(
      state.attempts[c.chainId + ":" + c.contract]?.status,
    ),
);
let index = 0,
  done = 0;
const save = () => {
  state.updatedAt = new Date().toISOString();
  writeFileSync(file + ".tmp", JSON.stringify(state, null, 2));
  renameSync(file + ".tmp", file);
};
async function worker() {
  while (index < jobs.length) {
    const c = jobs[index++],
      key = c.chainId + ":" + c.contract;
    const endpoint =
      c.chainId === 1
        ? "https://ethereum-rpc.publicnode.com"
        : "https://optimism-rpc.publicnode.com";
    async function rpc(method, params) {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      const d = await r.json();
      if (!r.ok || d.error || d.result === undefined)
        throw Error("RPC unavailable");
      return d.result;
    }
    try {
      const block = await rpc("eth_blockNumber", []);
      const minted = BigInt(
        await rpc("eth_call", [
          { to: c.contract, data: toFunctionSelector("totalMinted()") },
          block,
        ]),
      );
      const observation = {
        checkedAt: new Date().toISOString(),
        blockNumber: parseInt(block, 16),
        totalMinted: minted.toString(),
      };
      if (minted === 0n)
        state.attempts[key] = {
          ...observation,
          status: "unminted",
          reason:
            "totalMinted() is zero at the recorded block; no minted token can be recovered.",
        };
      else {
        const tokenId = minted.toString();
        const v = await readNFT({ ...c, tokenId, kind: "audio" });
        if (v.status !== "live") {
          state.attempts[key] = {
            ...observation,
            status: "unavailable",
            tokenId,
            reason:
              "Last minted token metadata unavailable; token may have burned or storage is unavailable.",
          };
        } else {
          const id = `fallback-sound-${c.chainId}-${c.contract.slice(2)}`;
          const r = {
            id,
            title: v.title.replace(/\s*#\d+$/, ""),
            artist: v.artist || "Artist not identified in metadata",
            chainId: c.chainId,
            contract: c.contract,
            tokenId,
            kind: "audio",
            imageURI: v.imageURI,
            platform: "Sound",
            creator: c.creator,
            factory: c.factory,
            factoryVersion: c.version,
            discovery: c.transaction,
            note: "Recovered through the factory-proven Sound contract using a later token after token 1 could not be resolved.",
          };
          const prior = state.records.findIndex((x) => x.id === id);
          if (prior < 0) state.records.push(r);
          else state.records[prior] = r;
          state.evidence[id] = v;
          state.attempts[key] = { ...observation, status: "live", tokenId };
        }
      }
    } catch (e) {
      state.attempts[key] = {
        status: "unavailable",
        reason: e.message,
        checkedAt: new Date().toISOString(),
      };
    }
    done++;
    if (done % 25 === 0) {
      save();
      console.log(
        "FALLBACK",
        done,
        "/",
        jobs.length,
        "recovered",
        state.records.length,
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}
await Promise.all(Array.from({ length: 10 }, worker));
state.finishedAt = new Date().toISOString();
save();
console.log(
  "FALLBACK FINISHED",
  state.records.length,
  Object.values(state.attempts).reduce(
    (a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a),
    {},
  ),
);
