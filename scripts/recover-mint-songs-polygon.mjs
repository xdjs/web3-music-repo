import {
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import {
  decodeMintSongsPolygon,
  MINT_SONGS_POLYGON,
} from "../src/mint-songs-polygon.mjs";
import { mintSongsTokenURI } from "../src/mint-songs.mjs";
const option = (name, fallback) =>
  process.argv
    .find((x) => x.startsWith(`--${name}=`))
    ?.slice(name.length + 3) || fallback;
const limit = Number(option("limit", "30")),
  concurrency = Number(option("concurrency", "2"));
if (
  !Number.isInteger(limit) ||
  limit < 1 ||
  limit > 1000 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 4
)
  throw Error("Limit must be 1–1000 and concurrency 1–4");
const explicit = option("tokens", "");
if (!explicit && !process.argv.includes("--scan"))
  throw Error("Provide --tokens=1,2,... or --scan --limit=30");
const path = "data/mint-songs/polygon-discovery.json",
  lock = path + ".lock";
const handle = openSync(lock, "wx");
writeFileSync(handle, `${process.pid}\n`);
const rpcURL = "https://polygon-bor-rpc.publicnode.com";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextRequest = 0;
async function pace() {
  const at = Math.max(Date.now(), nextRequest);
  nextRequest = at + 250;
  await sleep(at - Date.now());
}
async function rpc(method, params) {
  await pace();
  const response = await fetch(rpcURL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`RPC HTTP ${response.status}`);
  const result = await response.json();
  if (result.error)
    throw Error(`RPC ${result.error.code}: ${result.error.message}`);
  if (!result.result) throw Error("Missing RPC result");
  return result;
}
async function audioHead(uri) {
  const url = `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
  await pace();
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  return {
    uri,
    url,
    checkedAt: new Date().toISOString(),
    status: response.status,
    contentType: response.headers.get("content-type"),
    contentLength: Number(response.headers.get("content-length")) || null,
    playbackVerified: false,
  };
}
try {
  const output = JSON.parse(readFileSync(path));
  if ((await rpc("eth_chainId", [])).result !== "0x89")
    throw Error("Wrong chain");
  const currentBlock = (await rpc("eth_blockNumber", [])).result;
  const block =
    !explicit && output.scan?.referenceBlock
      ? `0x${output.scan.referenceBlock.toString(16)}`
      : currentBlock;
  const name = mintSongsTokenURI(
    (
      await rpc("eth_call", [
        { to: MINT_SONGS_POLYGON, data: "0x06fdde03" },
        block,
      ])
    ).result,
  );
  if (name !== "MintSongs721") throw Error("Wrong contract name");
  const supply = await rpc("eth_call", [
    { to: MINT_SONGS_POLYGON, data: "0x18160ddd" },
    block,
  ]);
  const maxToken = Number(BigInt(supply.result));
  if (!Number.isSafeInteger(maxToken)) throw Error("Unsafe token bound");
  output.mintedCounter = maxToken;
  output.supply = {
    referenceBlock: Number(BigInt(block)),
    response: supply,
    meaning:
      "Contract token counter, not distinct song count or current unburned supply",
  };
  output.runs ||= [];
  const run = {
    startedAt: new Date().toISOString(),
    referenceBlock: Number(BigInt(block)),
    mode: explicit ? "selected-tokens" : "sequential-scan",
    limit,
    concurrency,
    attempted: 0,
    finishedAt: null,
  };
  output.runs.push(run);
  const existing = new Map(output.samples.map((s) => [String(s.tokenId), s]));
  let ids;
  if (explicit) ids = [...new Set(explicit.split(","))];
  else {
    output.scan ||= {
      referenceBlock: Number(BigInt(block)),
      nextToken: 1,
      exhausted: false,
    };
    ids = Array.from(
      { length: Math.min(limit, maxToken - output.scan.nextToken + 1) },
      (_, i) => String(output.scan.nextToken + i),
    );
  }
  if (
    ids.length > limit ||
    ids.some((id) => !/^[1-9]\d*$/.test(id) || BigInt(id) > BigInt(maxToken))
  )
    throw Error("Invalid token list or exceeds --limit");
  const save = () => {
    output.checkedAt = new Date().toISOString();
    output.samples = [...existing.values()].sort(
      (a, b) => Number(a.tokenId) - Number(b.tokenId),
    );
    output.peteMatches = output.samples
      .filter((s) =>
        /pete\s*rango|p3t3rango/i.test(JSON.stringify(s.metadata || {})),
      )
      .map((s) => s.tokenId);
    writeFileSync(path + ".tmp", JSON.stringify(output, null, 2) + "\n");
    renameSync(path + ".tmp", path);
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < ids.length) {
        const tokenId = ids[next++];
        if (existing.has(tokenId) && !process.argv.includes("--retry"))
          continue;
        const sample = {
          tokenId,
          checkedAt: new Date().toISOString(),
          referenceBlock: Number(BigInt(block)),
          status: "unresolved",
        };
        try {
          sample.rpcResponse = await rpc("eth_call", [
            {
              to: MINT_SONGS_POLYGON,
              data: `0xc87b56dd${BigInt(tokenId).toString(16).padStart(64, "0")}`,
            },
            block,
          ]);
          const decoded = decodeMintSongsPolygon(sample.rpcResponse.result);
          sample.metadataURI = decoded.uri;
          sample.metadata = decoded.metadata;
          sample.isTest = decoded.isTest;
          sample.status = "decoded-onchain-json";
          if (!sample.isTest) {
            try {
              sample.mediaCheck = await audioHead(decoded.mediaURI);
            } catch (error) {
              sample.mediaCheck = {
                uri: decoded.mediaURI,
                status: "unresolved",
                reason: error.message,
                retryable: true,
              };
            }
          }
        } catch (error) {
          sample.reason = error.message;
          sample.retryable = !sample.rpcResponse?.result;
        }
        // An unsuccessful retry does not discard previously decoded original data.
        if (
          existing.get(tokenId)?.status === "decoded-onchain-json" &&
          sample.status === "unresolved"
        )
          existing.get(tokenId).latestRetry = sample;
        else {
          const previous = existing.get(tokenId);
          if (
            previous?.mediaCheck?.status === 200 &&
            sample.mediaCheck?.status !== 200 &&
            sample.metadataURI === previous.metadataURI
          ) {
            sample.latestMediaRetry = sample.mediaCheck;
            sample.mediaCheck = previous.mediaCheck;
          }
          existing.set(tokenId, sample);
        }
        run.attempted++;
        save();
        console.log(
          tokenId,
          sample.status,
          sample.isTest ? "test" : sample.metadata?.name || sample.reason,
        );
      }
    }),
  );
  if (!explicit) {
    output.scan.nextToken += ids.length;
    output.scan.exhausted = output.scan.nextToken > maxToken;
    output.scan.unresolvedTokens = output.samples
      .filter((s) => s.status === "unresolved")
      .map((s) => s.tokenId);
    output.scan.complete =
      output.scan.exhausted && !output.scan.unresolvedTokens.length;
  }
  run.finishedAt = new Date().toISOString();
  save();
} finally {
  closeSync(handle);
  unlinkSync(lock);
}
