import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { storageURL } from "../src/nft-reader.mjs";
import {
  MUSIC_METADATA_SCHEMA_VERSION,
  extractMusicMetadata,
} from "../src/extract-music-metadata.mjs";
import {
  metadataSnapshotKey,
  mergeMusicMetadataFacts,
  hasAdditionalMusicFacts,
} from "../src/music-metadata-enrichment.mjs";
const bundle = createCatalogLoader()(),
  file = "data/music-metadata.json";
const load = (p, f) => {
  try {
    return JSON.parse(readFileSync(p));
  } catch {
    return f;
  }
};
const releaseLock = acquireRecoveryLock(file);
const result = load(file, { records: {} });
result.startedAt = new Date().toISOString();
result.finishedAt = null;
result.interruptedAt = null;
let stopping = false;
process.once("SIGTERM", () => {
  stopping = true;
});
process.once("SIGINT", () => {
  stopping = true;
});
result.scope =
  "Original metadata and explicitly attributed publisher snapshots; audio analysis is stored separately";
const snapshots = {
  ...load("data/catalog/original-metadata.json", {}),
  ...load("data/catalog/ethereum-original-metadata.json", {}),
};
const mintOriginals = load("data/mint-songs/original-metadata.json", {});
const cacheDir = "work/music-metadata-cache";
const additionalCacheDir = process.argv
  .find((a) => a.startsWith("--cache-dir="))
  ?.slice(12);
const cacheOnly = process.argv.includes("--cache-only");
mkdirSync(cacheDir, { recursive: true });
const cachePath = (source) =>
  `${cacheDir}/${createHash("sha256").update(source).digest("hex")}.json`;
const filter = process.argv.find((a) => a.startsWith("--platform="))?.slice(11);
const refresh = process.argv.includes("--refresh");
const records = bundle.records.filter(
  (r) =>
    (!filter || r.platform === filter) &&
    (refresh ||
      result.records[r.id]?.schemaVersion !== MUSIC_METADATA_SCHEMA_VERSION),
);
const save = () => {
  result.updatedAt = new Date().toISOString();
  result.counts = {
    total: bundle.records.length,
    read: bundle.records.filter((r) => result.records[r.id]?.status === "read")
      .length,
    pendingOrUnavailable: bundle.records.filter(
      (r) => result.records[r.id]?.status !== "read",
    ).length,
  };
  writeFileSync(file + ".tmp", JSON.stringify(result, null, 2));
  renameSync(file + ".tmp", file);
};
let next = 0,
  done = 0,
  nextRequest = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pace() {
  const now = Date.now(),
    at = Math.max(now, nextRequest);
  nextRequest = at + 300;
  await sleep(at - now);
}
async function read(source) {
  const path = cachePath(source);
  if (existsSync(path)) return load(path, null);
  if (source.startsWith("data:application/json;base64,"))
    return JSON.parse(Buffer.from(source.split(",")[1], "base64").toString());
  for (let attempt = 0; attempt < 3; attempt++) {
    let url = storageURL(source);
    try {
      for (let redirects = 0; redirects < 4; redirects++) {
        await pace();
        const res = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        });
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          url = storageURL(new URL(res.headers.get("location"), url).href);
          await res.body?.cancel();
          continue;
        }
        if (res.status === 429) {
          const retry = Number(res.headers.get("retry-after"));
          await res.body?.cancel();
          nextRequest = Math.max(
            nextRequest,
            Date.now() + Math.min(60000, Math.max(5000, (retry || 5) * 1000)),
          );
          throw Error("Metadata HTTP 429 (retryable)");
        }
        if (!res.ok) throw Error("Metadata HTTP " + res.status);
        let bytes = 0;
        const chunks = [];
        for await (const chunk of res.body) {
          bytes += chunk.length;
          if (bytes > 1048576) throw Error("Metadata exceeds limit");
          chunks.push(chunk);
        }
        const metadata = JSON.parse(Buffer.concat(chunks).toString());
        writeFileSync(path, JSON.stringify(metadata));
        return metadata;
      }
      throw Error("Redirect limit");
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
}
// Re-extract saved documents before touching rate-limited gateways.
for (const r of records) {
  const key = metadataSnapshotKey(r),
    s = snapshots[key],
    v = bundle.evidence[r.id];
  const source = s?.source || v?.metadataURI || v?.metadataURL;
  const metadata =
    s?.metadata ||
    mintOriginals[r.id]?.results ||
    (source && existsSync(cachePath(source))
      ? load(cachePath(source), null)
      : additionalCacheDir && source
        ? load(
            `${additionalCacheDir}/${createHash("sha256").update(source).digest("hex")}.json`,
            null,
          )
        : null);
  if (!metadata) continue;
  const extracted = extractMusicMetadata(metadata);
  if (
    result.records[r.id]?.status === "read" &&
    !hasAdditionalMusicFacts(result.records[r.id], extracted)
  )
    continue;
  result.records[r.id] = {
    ...result.records[r.id],
    status: "read",
    schemaVersion: MUSIC_METADATA_SCHEMA_VERSION,
    ...mergeMusicMetadataFacts(result.records[r.id], extracted),
    source,
    metadataURL: v?.metadataURL || null,
    provenance: s
      ? "Catalog official metadata snapshot"
      : mintOriginals[r.id]
        ? "Neume preserved Mint Songs metadata"
        : "Previously fetched original metadata",
    ...(s ? { snapshotDate: s.snapshotDate } : {}),
    checkedAt: result.records[r.id]?.checkedAt || new Date().toISOString(),
    parsedAt: new Date().toISOString(),
    referenceBlock: v?.blockNumber || null,
  };
}
save();
if (!cacheOnly)
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (!stopping && next < records.length) {
        const r = records[next++];
        if (
          result.records[r.id]?.schemaVersion ===
            MUSIC_METADATA_SCHEMA_VERSION &&
          !refresh
        )
          continue;
        const v = bundle.evidence[r.id],
          source = v?.metadataURI || v?.metadataURL;
        if (!source) {
          result.records[r.id] = {
            status: "missing-reference",
            checkedAt: new Date().toISOString(),
          };
          continue;
        }
        try {
          const metadata = await read(source);
          result.records[r.id] = {
            ...result.records[r.id],
            status: "read",
            schemaVersion: MUSIC_METADATA_SCHEMA_VERSION,
            ...mergeMusicMetadataFacts(
              result.records[r.id],
              extractMusicMetadata(metadata),
            ),
            source,
            metadataURL: v.metadataURL || null,
            checkedAt: new Date().toISOString(),
            referenceBlock: v.blockNumber || null,
          };
        } catch (e) {
          const previous = result.records[r.id];
          result.records[r.id] =
            previous?.status === "read"
              ? { ...previous, lastRefreshError: e.message }
              : {
                  status: "unavailable",
                  source,
                  error: e.message,
                  checkedAt: new Date().toISOString(),
                };
        }
        if (++done % 25 === 0) {
          save();
          console.log(
            "MUSIC METADATA",
            done,
            "/",
            records.length,
            JSON.stringify(result.counts),
          );
        }
      }
    }),
  );
result.finishedAt = stopping ? null : new Date().toISOString();
result.interruptedAt = stopping ? new Date().toISOString() : null;
save();
result.lastPass = {
  cacheOnly,
  scope: filter || "all-platforms",
  selectedRecords: records.length,
};
save();
releaseLock();
console.log(
  stopping ? "MUSIC METADATA CHECKPOINTED" : "MUSIC METADATA COMPLETE",
  JSON.stringify(result.counts),
);
