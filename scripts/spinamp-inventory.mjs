// Read-only public Spindexer inventory. No media files or private user data.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const endpoint = "https://api.spinamp.xyz/v3/graphql",
  dir = "work/spinamp/inventory-pages";
mkdirSync(dir, { recursive: true });
const query = `query RecoveryInventory($after: Cursor, $first: Int!) { allProcessedTracks(first: $first, after: $after, orderBy: PRIMARY_KEY_ASC) { totalCount pageInfo { hasNextPage endCursor } nodes { id title platformId platformInternalId websiteUrl artistId createdAtTime lossyAudioUrl lossyAudioIpfsHash lossyArtworkUrl lossyArtworkIpfsHash duration artistByArtistId { name slug } } } }`;
const stateFile = dir + "/state.json";
let state = existsSync(stateFile)
  ? JSON.parse(readFileSync(stateFile))
  : {
      startedAt: new Date().toISOString(),
      endpoint,
      query,
      pages: [],
      after: null,
      complete: false,
    };
for (let n = 0; n < 110 && !state.complete; n++) {
  let body, error;
  const variables = { after: state.after, first: 500 };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw Error("HTTP " + r.status);
      body = await r.json();
      if (body.errors) throw Error(JSON.stringify(body.errors).slice(0, 400));
      error = null;
      break;
    } catch (e) {
      error = e.message;
      if (attempt < 2)
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  if (error) {
    state.error = error;
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
    throw Error(error);
  }
  const page = body.data.allProcessedTracks;
  if (!page.nodes.length && page.pageInfo.hasNextPage)
    throw Error("Empty nonterminal page");
  if (page.pageInfo.endCursor === state.after && page.pageInfo.hasNextPage)
    throw Error("Repeated cursor");
  const index = state.pages.length;
  const raw = JSON.stringify({
    checkedAt: new Date().toISOString(),
    variables,
    ...page,
  });
  writeFileSync(`${dir}/${index}.json`, raw);
  state.pages.push({
    file: `${index}.json`,
    count: page.nodes.length,
    totalCount: page.totalCount,
    sha256: createHash("sha256").update(raw).digest("hex"),
  });
  state.after = page.pageInfo.endCursor;
  state.complete = !page.pageInfo.hasNextPage;
  state.updatedAt = new Date().toISOString();
  delete state.error;
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(
    "SPINAMP",
    index + 1,
    state.pages.reduce((n, p) => n + p.count, 0),
    "/",
    page.totalCount,
  );
  await new Promise((r) => setTimeout(r, 150));
}
const records = state.pages.flatMap(
  (p) => JSON.parse(readFileSync(dir + "/" + p.file)).nodes,
);
const out = {
  source: endpoint,
  startedAt: state.startedAt,
  finishedAt: new Date().toISOString(),
  complete: state.complete,
  pages: state.pages,
  scope:
    "Public processed-track catalog; indexer assertions, not independent chain/playback verification.",
  records,
};
const raw = JSON.stringify(out);
writeFileSync("data/spinamp/inventory.json.gz", gzipSync(raw));
writeFileSync(
  "data/spinamp/inventory-manifest.json",
  JSON.stringify(
    {
      ...state,
      records: records.length,
      uniqueIds: new Set(records.map((x) => x.id)).size,
      uncompressedBytes: Buffer.byteLength(raw),
      sha256: createHash("sha256").update(raw).digest("hex"),
    },
    null,
    2,
  ),
);
