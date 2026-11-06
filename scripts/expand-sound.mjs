import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { readNFT } from "../src/nft-reader.mjs";
const file = "data/sound-expanded.json";
let state;
try {
  state = JSON.parse(readFileSync(file));
} catch {
  state = {
    startedAt: new Date().toISOString(),
    scope:
      "Factory-proven Sound protocol release contracts; one representative token per release",
    records: [],
    evidence: {},
    attempts: {},
  };
}
const states = ["1-1", "2-1", "1-10", "2-10"].flatMap((key) => {
  try {
    const d = JSON.parse(readFileSync("data/census/" + key + ".json"));
    return d.collections.map((c) => ({
      ...c,
      chainId: d.chainId,
      version: d.version,
      toBlock: d.toBlock,
      factory: d.factory,
    }));
  } catch {
    return [];
  }
});
const seen = new Set(),
  jobs = states.filter((c) => {
    const k = c.chainId + ":" + c.contract;
    if (seen.has(k)) return false;
    seen.add(k);
    return state.attempts[k]?.status !== "live";
  });
state.passStartedAt = new Date().toISOString();
delete state.finishedAt;
let index = 0;
const save = () => {
  state.updatedAt = new Date().toISOString();
  writeFileSync(file + ".tmp", JSON.stringify(state, null, 2));
  renameSync(file + ".tmp", file);
};
async function worker() {
  while (index < jobs.length) {
    const c = jobs[index++],
      key = c.chainId + ":" + c.contract;
    let raw = null;
    const fetcher = async (url, options) => {
      if (options?.method === "POST") {
        const body = JSON.parse(options.body);
      }
      const res = await fetch(url, options);
      if (!options?.method || options.method === "GET") {
        try {
          if (res.ok) raw = await res.clone().json();
        } catch {}
      }
      return res;
    };
    let tokenId = "1";
    let v = await readNFT(
      { chainId: c.chainId, contract: c.contract, tokenId, kind: "audio" },
      fetcher,
    );
    if (v.status !== "live") {
      // Preserve a failed token-one read; a representative minted edition may differ.
      state.attempts[key] = {
        status: "unavailable",
        tokenId,
        checkedAt: new Date().toISOString(),
        reason:
          "Token 1 or its original metadata unavailable; minted-token fallback pending",
      };
    } else {
      const metadataArtist =
        typeof raw?.artist === "object" ? raw.artist?.name : raw?.artist;
      const artist = String(
        raw?.artist_name ||
          metadataArtist ||
          raw?.author ||
          v.artist ||
          "Artist not identified in metadata",
      ).slice(0, 200);
      const title = String(v.title || raw?.name || "Untitled release").replace(
        /\s*#\d+$/,
        "",
      );
      const id = `recovered-sound-${c.chainId}-${c.contract.slice(2)}`;
      const record = {
        id,
        title,
        artist,
        chainId: c.chainId,
        contract: c.contract,
        tokenId,
        kind: /video|\.mp4|\.webm/i.test(
          raw?.animation_mime_type || raw?.mime_type || v.mediaURI,
        )
          ? "video"
          : "audio",
        imageURI: v.imageURI,
        platform: "Sound",
        collection: title,
        creator: c.creator,
        factory: c.factory,
        factoryVersion: c.version,
        discovery: c.transaction,
        originalRelease: /^https:\/\/(www\.)?sound\.xyz\//.test(
          raw?.external_url || "",
        )
          ? raw.external_url
          : undefined,
        note:
          typeof raw?.description === "string"
            ? raw.description.slice(0, 2500)
            : "Recovered from a Sound protocol factory event and original token metadata. The contract is public; platform listing has not been independently established.",
      };
      const n = state.records.findIndex((r) => r.id === id);
      if (n >= 0) state.records[n] = record;
      else state.records.push(record);
      state.evidence[id] = v;
      state.attempts[key] = {
        status: "live",
        tokenId,
        checkedAt: v.checkedAt,
        blockNumber: v.blockNumber,
      };
    }
    if (index % 10 === 0 || index === jobs.length) {
      save();
      console.log(
        "EXPAND",
        index,
        "/",
        jobs.length,
        "recovered",
        state.records.length,
      );
    }
    await new Promise((r) => setTimeout(r, 180));
  }
}
await Promise.all(Array.from({ length: 20 }, worker));
state.finishedAt = new Date().toISOString();
save();
console.log(
  "EXPANSION PASS FINISHED",
  state.records.length,
  "/",
  Object.keys(state.attempts).length,
);
