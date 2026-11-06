import fs from "node:fs";
import { classifyLogResponse } from "./sound-resolution-model.mjs";
const factory = "0x0000000000aec84f5bfc2af15eafb943bf4e3522",
  topic = "0xe94db3a31c09b7894f023c1f9114859672be916ffa8282215d7d43595bdcb3e7";
const providers = {
  8453: {
    publicnode: "https://base-rpc.publicnode.com",
    base: "https://mainnet.base.org",
    drpc: "https://base.drpc.org",
  },
  137: {
    publicnode: "https://polygon-bor-rpc.publicnode.com",
    drpc: "https://polygon.drpc.org",
  },
};
const arg = (name, fallback) =>
  Number(
    process.argv.find((a) => a.startsWith("--" + name + "="))?.split("=")[1] ??
      fallback,
  );
const chainId = arg("chain", 8453),
  from = arg("from", chainId === 8453 ? 7272930 : 51327653),
  to = arg("to", from);
if (
  !providers[chainId] ||
  ![from, to].every(Number.isSafeInteger) ||
  from < 0 ||
  to < from ||
  to - from >= 1000
)
  throw Error("Use chain8453/137 and an inclusive range of at most1000blocks");
const file = `data/sound-resolution/rpc-${chainId}-${from}-${to}.json`;
const request = {
  jsonrpc: "2.0",
  id: 1,
  method: "eth_getLogs",
  params: [
    {
      address: factory,
      topics: [topic],
      fromBlock: "0x" + from.toString(16),
      toBlock: "0x" + to.toString(16),
    },
  ],
};
const state = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file))
  : {
      chainId,
      factory,
      fromBlock: from,
      toBlock: to,
      request,
      scope:
        "Bounded provider capability probe, not a factory census. An empty result only covers this exact range.",
      providers: {},
    };
const selected = process.argv
  .find((x) => x.startsWith("--provider="))
  ?.split("=")[1];
if (selected && !providers[chainId][selected])
  throw Error("Unknown fixed provider");
for (const [name, url] of Object.entries(providers[chainId])) {
  if (selected && selected !== name) continue;
  if (
    state.providers[name]?.status === "range-read" &&
    !process.argv.includes("--refresh")
  )
    continue;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(15000),
    });
    const response = await res.json();
    state.providers[name] = {
      url,
      httpStatus: res.status,
      checkedAt: new Date().toISOString(),
      response,
      ...classifyLogResponse(response),
    };
  } catch (e) {
    state.providers[name] = {
      url,
      checkedAt: new Date().toISOString(),
      status: "unavailable",
      reason: "request-error",
      message: e.message,
    };
  }
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + "\n");
  console.log(
    name,
    state.providers[name].status,
    state.providers[name].reason || state.providers[name].logCount,
  );
}
