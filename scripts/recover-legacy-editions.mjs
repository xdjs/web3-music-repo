import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { readNFT } from "../src/nft-reader.mjs";
const input = JSON.parse(readFileSync("data/census/0-1.json"));
const block = BigInt(input.toBlock);
const client = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com", {
    timeout: 15000,
    retryCount: 1,
  }),
  ccipRead: false,
});
const abi = parseAbi([
  "function editionCount() view returns (uint256)",
  "function tokenToEdition(uint256) view returns (uint256)",
  "function editions(uint256) view returns (address fundingRecipient,uint256 price,uint32 numSold,uint32 quantity,uint32 royaltyBPS,uint32 startTime,uint32 endTime,uint32 permissionedQuantity,address signerAddress,string baseURI)",
]);
const file = "data/legacy-expanded.json";
let state;
try {
  state = JSON.parse(readFileSync(file));
} catch {
  state = {
    startedAt: new Date().toISOString(),
    toBlock: input.toBlock,
    artists: {},
    records: [],
    evidence: {},
    scope:
      "All editions returned by editionCount on discovered legacy artist contracts; token representatives verified separately",
  };
}
const save = () => {
  state.updatedAt = new Date().toISOString();
  writeFileSync(file + ".tmp", JSON.stringify(state, null, 2));
  renameSync(file + ".tmp", file);
};
let index = 0;
async function worker() {
  while (index < input.collections.length) {
    const c = input.collections[index++];
    let artist = state.artists[c.contract];
    if (artist?.complete) continue;
    try {
      const count = await client.readContract({
        address: c.contract,
        abi,
        functionName: "editionCount",
        blockNumber: block,
      });
      if (count > 10000n) throw Error("Edition count exceeds safety bound");
      artist ||= {
        name: c.artistName,
        contract: c.contract,
        editionCount: Number(count),
        editions: [],
        toBlock: input.toBlock,
      };
      state.artists[c.contract] = artist;
      const defs = await client.multicall({
        contracts: Array.from({ length: Number(count) }, (_, i) => ({
          address: c.contract,
          abi,
          functionName: "editions",
          args: [BigInt(i + 1)],
        })),
        blockNumber: block,
        batchSize: 12000,
      });
      const missing = [];
      for (let i = 0; i < defs.length; i++) {
        const definition = defs[i];
        const editionId = i + 1;
        if (
          artist.editions.some(
            (e) => e.editionId === editionId && e.status === "live",
          )
        )
          continue;
        if (definition.status !== "success") {
          missing.push(editionId);
          continue;
        }
        const [recipient, , numSold, quantity, , , , , , baseURI] =
          definition.result;
        const entry = {
          editionId,
          numSold,
          quantity,
          fundingRecipient: recipient,
          baseURI,
          tokenId: ((BigInt(editionId) << 128n) | 1n).toString(),
        };
        const prior = artist.editions.findIndex(
          (e) => e.editionId === editionId,
        );
        if (prior >= 0) artist.editions[prior] = entry;
        else artist.editions.push(entry);
        if (!numSold) {
          entry.status = "unminted";
          continue;
        }
        const v = await recover(c, entry);
        if (v) entry.status = "live";
        else {
          entry.status = "needs-legacy-token";
          missing.push(editionId);
        }
      }
      // Pre-V3 token IDs were sequential. Recover the exact stored token->edition mapping, not a title guess.
      if (missing.length) {
        const mapping = async (n) =>
          client.readContract({
            address: c.contract,
            abi,
            functionName: "tokenToEdition",
            args: [BigInt(n)],
            blockNumber: block,
          });
        if ((await mapping(1)) > 0n) {
          let high = 2;
          while (high < 131072 && (await mapping(high)) > 0n) high *= 2;
          if (high >= 131072)
            throw Error("Legacy token search exceeds safety bound");
          let low = 1;
          while (low + 1 < high) {
            const mid = Math.floor((low + high) / 2);
            if ((await mapping(mid)) > 0n) low = mid;
            else high = mid;
          }
          artist.legacySequentialTokenCount = low;
          const representatives = new Map();
          for (let from = 1; from <= low; from += 200) {
            const vals = await client.multicall({
              contracts: Array.from(
                { length: Math.min(200, low - from + 1) },
                (_, i) => ({
                  address: c.contract,
                  abi,
                  functionName: "tokenToEdition",
                  args: [BigInt(from + i)],
                }),
              ),
              blockNumber: block,
              batchSize: 12000,
            });
            vals.forEach((v, i) => {
              if (
                v.status === "success" &&
                v.result > 0n &&
                !representatives.has(Number(v.result))
              )
                representatives.set(Number(v.result), String(from + i));
            });
          }
          for (const editionId of missing) {
            const e = artist.editions.find((e) => e.editionId === editionId);
            const tokenId = representatives.get(editionId);
            if (!e || !tokenId) continue;
            e.tokenId = tokenId;
            e.tokenIdMethod = "stored tokenToEdition mapping";
            e.status = (await recover(c, e)) ? "live" : "metadata-unavailable";
          }
        }
      }
      artist.complete = artist.editions.length === Number(count);
      artist.checkedAt = new Date().toISOString();
      delete artist.error;
      save();
      console.log(
        "LEGACY",
        index,
        "/",
        input.collections.length,
        c.artistName,
        "editions",
        count.toString(),
        "recovered",
        state.records.length,
      );
    } catch (e) {
      state.artists[c.contract] = {
        ...(artist || {}),
        contract: c.contract,
        name: c.artistName,
        error: e.message,
        complete: false,
      };
      save();
      console.log("LEGACY RETRY", c.artistName, e.message.slice(0, 120));
    }
  }
}
async function recover(c, e) {
  let raw;
  const fetcher = async (url, o) => {
    if (o?.method === "POST" && JSON.parse(o.body).method === "eth_blockNumber")
      return Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: "0x" + block.toString(16),
      });
    const r = await fetch(url, o);
    if (!o?.method && r.ok)
      try {
        raw = await r.clone().json();
      } catch {}
    return r;
  };
  const v = await readNFT(
    { chainId: 1, contract: c.contract, tokenId: e.tokenId, kind: "audio" },
    fetcher,
  );
  if (v.status !== "live") return false;
  const id = `recovered-legacy-${c.contract.slice(2)}-${e.editionId}`;
  const r = {
    id,
    title: v.title.replace(/\s*#\d+$/, ""),
    artist: v.artist || c.artistName || "Unidentified artist",
    chainId: 1,
    contract: c.contract,
    tokenId: e.tokenId,
    legacyEditionId: e.editionId,
    editionSupply: e.numSold,
    kind: "audio",
    imageURI: v.imageURI,
    platform: "Sound",
    collection: v.title.replace(/\s*#\d+$/, ""),
    factory: input.factory,
    factoryVersion: 0,
    originalRelease: /^https:\/\/(www\.)?sound\.xyz\//.test(
      raw?.external_url || "",
    )
      ? raw.external_url
      : undefined,
    note:
      raw?.description?.slice(0, 2500) ||
      "Recovered from the legacy Sound artist contract and its edition registry.",
  };
  const i = state.records.findIndex((x) => x.id === id);
  if (i >= 0) state.records[i] = r;
  else state.records.push(r);
  state.evidence[id] = v;
  save();
  return true;
}
await Promise.all(Array.from({ length: 3 }, worker));
state.finishedAt = new Date().toISOString();
save();
console.log("LEGACY FINISHED", state.records.length);
