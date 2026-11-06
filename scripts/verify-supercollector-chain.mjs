import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { decodeAbiParameters } from "viem";
const inventory = JSON.parse(
    readFileSync("data/supercollector/inventory.json"),
  ),
  path = "data/supercollector/chain-verification.json";
const prior = existsSync(path) ? JSON.parse(readFileSync(path)) : null;
const endpoint =
  process.env.SUPERCOLLECTOR_RPC || "https://mainnet.optimism.io";
const request = async (payload) => {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return r.json();
};
const block = prior?.blockNumber
  ? `0x${prior.blockNumber.toString(16)}`
  : (
      await request({
        jsonrpc: "2.0",
        id: 0,
        method: "eth_blockNumber",
        params: [],
      })
    ).result;
if (!/^0x[0-9a-f]+$/i.test(block)) throw Error("No stable block");
const classify = (r) =>
  r.type === "standard"
    ? r.value
      ? "verified"
      : "unsupported"
    : r.value === r.expected
      ? "verified"
      : r.expected &&
          r.value.replaceAll("{id}", String(r.number)) === r.expected
        ? "template-matches-index"
        : "mismatch";
const results = new Map(
  (prior?.results || []).map((r) => [
    r.key,
    r.value !== undefined ? { ...r, status: classify(r) } : r,
  ]),
);
const all = [];
for (const r of inventory.releases) {
  if (r.chainId !== 10) continue;
  all.push({
    key: r.address,
    type: "standard",
    address: r.address,
    data: "0x01ffc9a7" + "d9b67a26".padEnd(64, "0"),
  });
  for (const t of r.tracks.filter((t) => t.access === "public"))
    all.push({
      key: `${r.address}:${t.number}`,
      type: "uri",
      address: r.address,
      number: t.number,
      expected: t.metadataURI,
      data: "0x0e89341c" + BigInt(t.number).toString(16).padStart(64, "0"),
    });
}
const pending = all.filter(
  (j) => !results.has(j.key) || results.get(j.key).status === "unresolved",
);
const save = () =>
  writeFileSync(
    path,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        chainId: 10,
        endpoint,
        blockNumber: parseInt(block, 16),
        plannedCalls: all.length,
        note: "template-matches-index means the contract returns {id} and the public index provides a decimal-number metadata path; it is not an independently fetched metadata document.",
        results: [...results.values()],
      },
      null,
      2,
    ) + "\n",
  );
for (let start = 0; start < pending.length; start += 2) {
  const batch = pending.slice(start, start + 2);
  let blocked = false;
  try {
    const response = await request(
      batch.map((job, i) => ({
        jsonrpc: "2.0",
        id: start + i + 1,
        method: "eth_call",
        params: [{ to: job.address, data: job.data }, block],
      })),
    );
    if (!Array.isArray(response)) throw Error("RPC did not return batch");
    for (let i = 0; i < batch.length; i++) {
      const j = batch[i],
        got = response.find((x) => x.id === start + i + 1);
      if (got?.error || !got?.result) {
        const reason = got?.error?.message || "Missing RPC result";
        results.set(j.key, {
          ...j,
          data: undefined,
          status: "unresolved",
          reason,
        });
        if (/capacity|rate|limit/i.test(reason)) blocked = true;
        continue;
      }
      try {
        const value = decodeAbiParameters(
          [{ type: j.type === "uri" ? "string" : "bool" }],
          got.result,
        )[0];
        results.set(j.key, {
          ...j,
          data: undefined,
          status: classify({ ...j, value }),
          value,
        });
      } catch (e) {
        results.set(j.key, {
          ...j,
          data: undefined,
          status: "unresolved",
          reason: e.message,
        });
      }
    }
  } catch (e) {
    batch.forEach((j) =>
      results.set(j.key, {
        ...j,
        data: undefined,
        status: "unresolved",
        reason: e.message,
      }),
    );
    if (/429|403|413/.test(e.message)) blocked = true;
  }
  save();
  if (blocked) {
    console.log("Provider limit: preserved pending reads");
    break;
  }
  if (start % 40 === 0)
    console.log("retry", start + batch.length, "of", pending.length);
  await new Promise((r) => setTimeout(r, 1050));
}
save();
console.log(
  "results",
  [...results.values()].reduce(
    (s, r) => ((s[r.status] = (s[r.status] || 0) + 1), s),
    {},
  ),
);
