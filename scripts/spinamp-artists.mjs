// Minimal public musician identity fields only; no private collector/user profiles.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
const source = "https://api.spinamp.xyz/v3/graphql",
  path = "data/spinamp/artists.json.gz";
const state = existsSync(path)
  ? JSON.parse(gunzipSync(readFileSync(path)))
  : {
      source,
      startedAt: new Date().toISOString(),
      after: null,
      complete: false,
      artists: [],
    };
const query = `query($after:Cursor){allArtists(first:500,after:$after,orderBy:PRIMARY_KEY_ASC){totalCount pageInfo{hasNextPage endCursor}nodes{id name slug avatarIpfsHash}}}`;
for (let i = 0; i < 100 && !state.complete; i++) {
  const r = await fetch(source, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { after: state.after } }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await r.json();
  if (!r.ok || body.errors)
    throw Error(JSON.stringify(body.errors || r.status));
  const p = body.data.allArtists;
  if (p.pageInfo.hasNextPage && p.pageInfo.endCursor === state.after)
    throw Error("Repeated cursor");
  state.artists.push(...p.nodes);
  state.after = p.pageInfo.endCursor;
  state.complete = !p.pageInfo.hasNextPage;
  state.totalCount = p.totalCount;
  state.updatedAt = new Date().toISOString();
  writeFileSync(path, gzipSync(JSON.stringify(state)));
  console.log(state.artists.length, state.totalCount);
  await new Promise((r) => setTimeout(r, 150));
}
