import fs from "node:fs";
import { classifySoundSample } from "./sound-resolution-model.mjs";
import { decodeString, storageURL } from "../src/nft-reader.mjs";
import { alternateMediaURLs } from "../src/media-recovery.js";
const endpoints = {
  1: "https://ethereum-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
};
const output = "data/sound-resolution/sample-results.json";
const input = JSON.parse(
  fs.readFileSync("data/sound-resolution/sample-input.json"),
);
const prior = fs.existsSync(output)
  ? JSON.parse(fs.readFileSync(output))
  : { samples: [] };
const result = {
  ...prior,
  scope: input.scope,
  updatedAt: new Date().toISOString(),
  samples: prior.samples,
};
const limit = Number(
  process.argv.find((x) => x.startsWith("--limit="))?.split("=")[1] || 15,
);
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 30)
  throw Error("limit must be 1..30");
const refresh = process.argv.includes("--refresh");
const save = () => {
  result.updatedAt = new Date().toISOString();
  fs.writeFileSync(output + ".tmp", JSON.stringify(result, null, 2) + "\n");
  fs.renameSync(output + ".tmp", output);
};
const blocks = {};
async function rpc(chainId, method, params) {
  const r = await fetch(endpoints[chainId], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw Error("HTTP " + r.status);
  const d = await r.json();
  if (d.error) throw Error(d.error.message);
  if (d.result === undefined) throw Error("Missing RPC result");
  return d.result;
}
async function read(row, name, data) {
  try {
    const value = await rpc(row.chainId, "eth_call", [
      { to: row.contract, data },
      row.block,
    ]);
    row.calls.push({ name, data, result: value });
    return value;
  } catch (e) {
    row.calls.push({ name, data, error: e.message });
    return null;
  }
}
async function metadata(uri) {
  if (uri.startsWith("data:application/json;base64,"))
    return {
      metadata: JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString()),
      requests: [],
    };
  const canonical = storageURL(uri),
    requests = [];
  for (const source of [canonical, ...alternateMediaURLs(canonical)]) {
    let url = source;
    try {
      for (let redirects = 0; redirects < 4; redirects++) {
        const r = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(12000),
        });
        requests.push({ url, status: r.status });
        if ([301, 302, 303, 307, 308].includes(r.status)) {
          const target = storageURL(
            new URL(r.headers.get("location"), url).href,
          );
          requests.at(-1).redirect = target;
          url = target;
          continue;
        }
        if (!r.ok) break;
        let size = 0;
        const chunks = [];
        for await (const chunk of r.body) {
          size += chunk.length;
          if (size > 1048576) throw Error("Metadata too large");
          chunks.push(chunk);
        }
        return {
          metadata: JSON.parse(Buffer.concat(chunks).toString()),
          requests,
        };
      }
    } catch (e) {
      requests.push({ url, error: e.message });
    }
  }
  return { requests, error: "All tested storage routes unavailable" };
}
for (const item of input.records.slice(0, limit)) {
  if (!refresh && result.samples.some((x) => x.key === item.key)) continue;
  const row = {
    ...item,
    checkedAt: new Date().toISOString(),
    calls: [],
    metadataAttempts: [],
  };
  try {
    blocks[item.chainId] ??= await rpc(item.chainId, "eth_blockNumber", []);
    row.block = blocks[item.chainId];
    row.blockNumber = parseInt(row.block, 16);
    const minted = await read(row, "totalMinted", "0xa2309ff8");
    const supply = await read(row, "totalSupply", "0x18160ddd");
    row.totalMinted = minted ? BigInt(minted).toString() : null;
    row.totalSupply = supply ? BigInt(supply).toString() : null;
    row.classification = row.totalMinted === "0" ? "unminted" : "unresolved";
    if (row.totalMinted !== "0")
      for (const tokenId of [
        ...new Set(
          [
            "1",
            row.totalMinted,
            "2",
            row.totalMinted
              ? (BigInt(row.totalMinted) / 2n || 1n).toString()
              : null,
          ].filter(Boolean),
        ),
      ]) {
        const raw = await read(
          row,
          "tokenURI:" + tokenId,
          "0xc87b56dd" + BigInt(tokenId).toString(16).padStart(64, "0"),
        );
        if (!raw) continue;
        let uri;
        try {
          uri = decodeString(raw);
        } catch (e) {
          row.metadataAttempts.push({ tokenId, error: e.message });
          continue;
        }
        const recovered = await metadata(uri);
        row.metadataAttempts.push({ tokenId, uri, ...recovered });
        const m = recovered.metadata;
        if (m) {
          const media =
            m.animation_url || m.animation || m.audio || m.losslessAudio;
          let mediaURL;
          try {
            mediaURL = storageURL(media);
          } catch {}
          if (mediaURL) {
            row.classification = "metadata-recovered";
            row.recovered = {
              tokenId,
              metadataURI: uri,
              mediaURI: media,
              mediaURL,
              imageURI: m.image,
              title: m.name,
              artist:
                m.artist_name ||
                (typeof m.artist === "object" ? m.artist.name : m.artist) ||
                m.author ||
                "",
              description: m.description || "",
            };
            break;
          }
          row.classification = "metadata-without-supported-media";
        } else row.classification = "storage-unavailable";
      }
  } catch (e) {
    row.error = e.message;
    row.classification = "rpc-unavailable";
  }
  row.classification = classifySoundSample(row);
  const i = result.samples.findIndex((x) => x.key === row.key);
  if (i < 0) result.samples.push(row);
  else result.samples[i] = row;
  save();
  console.log(
    row.key,
    row.classification,
    row.totalMinted,
    row.recovered?.title || "",
  );
  await new Promise((r) => setTimeout(r, 250));
}
