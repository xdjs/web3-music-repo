// Bounded, explicit-release public index reads. Never scans a shared contract.
import {
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { normalizeSpinampCollectorSnapshot } from "../src/spinamp-collectors.mjs";
const source = "https://api.spinamp.xyz/v3/graphql",
  path = "data/spinamp/collector-snapshots.json";
const maxTokens = Number(process.env.SPINAMP_MAX_TOKENS || 200);
if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 300)
  throw Error("Token bound must be 1..300");
const reportPath =
  process.env.SPINAMP_COLLECTOR_REPORT ||
  "data/spinamp/collector-expansion-2026-11-06.json";
const ids = process.argv.slice(2);
if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length)
  throw Error("Provide 1..20 distinct catalog record IDs");
const bundle = JSON.parse(readFileSync("data/spinamp/recovered-media.json")),
  byId = new Map(bundle.records.map((r) => [r.id, r]));
const selected = ids.map((id) => {
  const r = byId.get(id);
  if (
    !r ||
    r.platform !== "Lens" ||
    r.standard !== "ERC721" ||
    r.chainId !== 137 ||
    !bundle.evidence[id]?.metadataURI?.startsWith("ipfs://")
  )
    throw Error(
      "Only explicit Lens ERC721/IPFS release records supported in this bounded cohort: " +
        id,
    );
  return r;
});
const lockPath = path + ".lock",
  lock = openSync(lockPath, "wx");
writeFileSync(lock, String(process.pid));
closeSync(lock);
const snapshots = JSON.parse(readFileSync(path)),
  report = {
    startedAt: new Date().toISOString(),
    source,
    scope:
      "Exact Lens release relations and indexed ownership; index freshness unknown, not fresh chain balances",
    maximumRequests: 100,
    maximumTokensPerRelease: maxTokens,
    beforeSnapshots: Object.keys(snapshots.records).length,
    results: [],
  };
let requests = 0,
  failures = 0;
async function read(query) {
  if (requests >= 100) throw Error("Request budget exhausted");
  requests++;
  const response = await fetch(source, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("HTTP " + response.status);
  const body = await response.json();
  const receipt = { checkedAt: new Date().toISOString(), source, query, body };
  if (body.errors?.length)
    throw Error(body.errors[0].message || "GraphQL error");
  await new Promise((r) => setTimeout(r, 500));
  return receipt;
}
try {
  for (const r of selected) {
    const item = { recordId: r.id, title: r.title, artist: r.artist };
    try {
      const relations = await read(
        `{relations:allNftsProcessedTracks(condition:{processedTrackId:${JSON.stringify(r.spinampTrackId)}},first:${maxTokens},orderBy:PRIMARY_KEY_ASC){totalCount pageInfo{hasNextPage endCursor}nodes{processedTrackId nftByNftId{id chainId contractAddress tokenId tokenUri nftFactoryByNftFactoryId{standard}}}}}`,
      );
      const c = relations.body?.data?.relations;
      if (
        !Array.isArray(c?.nodes) ||
        !Number.isSafeInteger(c.totalCount) ||
        c.totalCount < 1 ||
        c.totalCount > maxTokens ||
        c.pageInfo?.hasNextPage !== false ||
        c.nodes.length !== c.totalCount
      )
        throw Error("Incomplete or out-of-budget release relation census");
      for (const n of c.nodes) {
        if (
          n.processedTrackId !== r.spinampTrackId ||
          n.nftByNftId?.chainId !== "polygon" ||
          n.nftByNftId.contractAddress?.toLowerCase() !== r.contract ||
          n.nftByNftId.tokenUri !== bundle.evidence[r.id].metadataURI
        )
          throw Error("Release relation identity or metadata mismatch");
      }
      const responses = [];
      for (let start = 0; start < c.nodes.length; start += 10) {
        const group = c.nodes.slice(start, start + 10),
          query =
            "{" +
            group
              .map(
                ({ nftByNftId: n }, i) =>
                  `n${i}:nftById(id:${JSON.stringify(n.id)}){id chainId contractAddress tokenId tokenUri nftsCollectorsByNftId(first:100){totalCount pageInfo{hasNextPage endCursor}nodes{nftId addressId amount}}}`,
              )
              .join("\n") +
            "}";
        responses.push(await read(query));
      }
      const evidence = {
          recordId: r.id,
          trackId: r.spinampTrackId,
          chainId: r.chainId,
          contract: r.contract,
          metadataURI: bundle.evidence[r.id].metadataURI,
          relations,
          owners: { source, responses },
        },
        normalized = normalizeSpinampCollectorSnapshot(evidence);
      snapshots.records[r.id] = evidence;
      writeFileSync(path + ".tmp", JSON.stringify(snapshots, null, 2) + "\n");
      renameSync(path + ".tmp", path);
      Object.assign(item, {
        status: "indexed",
        mappedTokens: normalized.mappedTokenCount,
        wallets: normalized.items.length,
        checkedAt: normalized.checkedAt,
      });
      failures = 0;
    } catch (e) {
      item.status = "unresolved";
      item.error = e.message;
      failures++;
    }
    report.results.push(item);
    console.log(JSON.stringify(item));
    if (failures >= 3 || requests >= 100) {
      report.stopReason = "Bounded failure/request limit reached";
      break;
    }
  }
} finally {
  report.finishedAt = new Date().toISOString();
  report.requests = requests;
  report.afterSnapshots = Object.keys(snapshots.records).length;
  report.stopReason ||= "Explicit selected cohort completed";
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  unlinkSync(lockPath);
}
