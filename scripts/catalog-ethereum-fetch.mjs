import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
const input = JSON.parse(
  readFileSync("data/catalog/ethereum-revenue-candidates.json"),
);
const dir = "data/catalog/ethereum-revenue-evidence";
const limit = Number(
  process.argv.find((s) => s.startsWith("--limit="))?.slice(8) || 20,
);
if (!Number.isInteger(limit) || limit < 1 || limit > input.candidates.length)
  throw Error(`Limit must be 1–${input.candidates.length}`);
mkdirSync(dir, { recursive: true });
const rpc = "https://eth.drpc.org";
let requestId = 0;
async function read(method, params) {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`RPC HTTP ${response.status}; retryable`);
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 2097152) throw Error("RPC response too large");
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (body.error || body.result === null || body.result === undefined)
    throw Error("RPC result unavailable; retryable");
  return body.result;
}
const chainId = await read("eth_chainId", []);
if (chainId !== "0x1") throw Error("Wrong network");
const previous = existsSync(`${dir}/rpc-provenance.json`)
  ? JSON.parse(readFileSync(`${dir}/rpc-provenance.json`))
  : {};
const failures = [],
  attempts = [];
let fetched = 0;
for (const candidate of input.candidates.slice(0, limit)) {
  const path = `${dir}/${candidate.transactionHash}.json`;
  if (existsSync(path)) continue;
  try {
    writeFileSync(
      path,
      JSON.stringify(
        await read("eth_getTransactionReceipt", [candidate.transactionHash]),
        null,
        2,
      ) + "\n",
    );
    fetched++;
    attempts.push({
      transactionHash: candidate.transactionHash,
      status: "recovered",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    attempts.push({
      transactionHash: candidate.transactionHash,
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      reason: error.message,
    });
    failures.push({
      transactionHash: candidate.transactionHash,
      reason: error.message,
    });
  }
  if (attempts.length % 10 === 0)
    console.log(
      "ETHEREUM RECEIPTS",
      fetched,
      "new",
      failures.length,
      "unavailable",
    );
  await new Promise((resolve) => setTimeout(resolve, 550));
}
writeFileSync(
  `${dir}/rpc-provenance.json`,
  JSON.stringify(
    {
      ...previous,
      lastReceiptFetchAt: new Date().toISOString(),
      rpc,
      chainId,
      failures,
      fetchHistory: [...(previous.fetchHistory || []), ...attempts],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ attemptedCohort: limit, fetched, failures }, null, 2),
);
