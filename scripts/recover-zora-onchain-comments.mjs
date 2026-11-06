import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { keccak256, toHex } from "viem";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { verifiedMintComment } from "../src/zora-comments.mjs";

const chainId = Number(
  process.argv.find((a) => a.startsWith("--chain="))?.split("=")[1] || 7777777,
);
const rpcURL = {
  7777777: "https://rpc.zora.energy",
  8453: "https://base-rpc.publicnode.com",
  1: "https://ethereum-rpc.publicnode.com",
}[chainId];
if (!rpcURL) throw Error("Unsupported chain");
const outputFile =
  chainId === 7777777
    ? "data/zora-onchain-comments.json"
    : `data/zora-onchain-comments-${chainId}.json`;
const explorer = {
  7777777: "https://explorer.zora.energy",
  8453: "https://basescan.org",
  1: "https://etherscan.io",
}[chainId];
const commit = "32c2931a444b4405b107a49016dff0059b05b06f";
const deploymentSource = `https://github.com/ourzora/zora-protocol/blob/${commit}/legacy/1155-contracts/addresses/${chainId}.json`;
const sourceCode = `https://github.com/ourzora/zora-protocol/blob/${commit}/legacy/1155-contracts/src/minters/fixed-price/ZoraCreatorFixedPriceSaleStrategy.sol`;
const deployment = JSON.parse(
  readFileSync(`evidence/zora-deployments-${chainId}.json`, "utf8"),
);
const emitter = deployment.FIXED_PRICE_SALE_STRATEGY.toLowerCase();
const records = createCatalogLoader()().records.filter(
  (record) => record.platform === "Zora" && record.chainId === chainId,
);
const contracts = [
  ...new Set(records.map((record) => record.contract.toLowerCase())),
];
const result = {
  checkedAt: new Date().toISOString(),
  chainId,
  rpcURL,
  emitter,
  deploymentSource,
  sourceCode,
  scope:
    "Selected archive collections on the specified network; fixed-price ERC1155 MintComment only. Not all Zora music or all comment mechanisms.",
  scans: [],
  comments: [],
};
async function rpc(method, params) {
  const response = await fetch(rpcURL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  const value = await response.json();
  if (!response.ok || value.error || value.result == null)
    throw Error(value.error?.message || `RPC HTTP ${response.status}`);
  return value.result;
}
if (Number(BigInt(await rpc("eth_chainId", []))) !== chainId)
  throw Error("Wrong chain");
result.endBlock = await rpc("eth_blockNumber", []);
result.endBlockHash = (
  await rpc("eth_getBlockByNumber", [result.endBlock, false])
).hash;
const code = await rpc("eth_getCode", [emitter, result.endBlock]);
if (code === "0x") throw Error("Minter code missing");
result.minterRuntimeHash = keccak256(code);
const receipts = new Map();
mkdirSync("evidence/zora-comments", { recursive: true });
for (const contract of contracts) {
  const scan = {
    contract,
    fromBlock: "0x0",
    toBlock: result.endBlock,
    status: "unavailable",
  };
  try {
    const logs = await rpc("eth_getLogs", [
      {
        address: emitter,
        fromBlock: "0x0",
        toBlock: result.endBlock,
        topics: [
          keccak256(
            toHex("MintComment(address,address,uint256,uint256,string)"),
          ),
          null,
          "0x" + contract.slice(2).padStart(64, "0"),
        ],
      },
    ]);
    if (!Array.isArray(logs) || logs.length >= 10000)
      throw Error("Invalid or potentially capped log response");
    writeFileSync(
      `evidence/zora-comments/${contract}-logs.json`,
      JSON.stringify(logs, null, 2),
    );
    let next = 0;
    const verified = [],
      failures = [],
      rejected = [];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (next < logs.length) {
          const log = logs[next++];
          try {
            if (!receipts.has(log.transactionHash))
              receipts.set(
                log.transactionHash,
                rpc("eth_getTransactionReceipt", [log.transactionHash]),
              );
            const receipt = await receipts.get(log.transactionHash);
            writeFileSync(
              `evidence/zora-comments/${log.transactionHash}.json`,
              JSON.stringify(receipt, null, 2),
            );
            const comment = verifiedMintComment(log, receipt, {
              chainId,
              emitter,
              endBlock: result.endBlock,
            });
            if (!comment) {
              rejected.push(log.transactionHash + ":" + log.logIndex);
              continue;
            }
            comment.timestamp = (
              await rpc("eth_getBlockByNumber", [log.blockNumber, false])
            ).timestamp;
            comment.source = `${explorer}/tx/${log.transactionHash}`;
            comment.deploymentSource = deploymentSource;
            comment.recordIds = records
              .filter(
                (r) =>
                  r.contract.toLowerCase() === comment.contract &&
                  r.tokenId === comment.tokenId,
              )
              .map((r) => r.id);
            verified.push(comment);
          } catch (error) {
            failures.push({
              transaction: log.transactionHash,
              logIndex: log.logIndex,
              error: error.message,
            });
          }
        }
      }),
    );
    result.comments.push(...verified);
    Object.assign(scan, {
      status: failures.length ? "partial" : "indexed",
      candidateLogs: logs.length,
      verified: verified.length,
      matched: verified.filter((c) => c.recordIds.length).length,
      failures,
      rejected,
    });
  } catch (error) {
    scan.error = error.message;
  }
  result.scans.push(scan);
  console.log(JSON.stringify(scan));
}
if (
  (await rpc("eth_getBlockByNumber", [result.endBlock, false])).hash !==
  result.endBlockHash
)
  throw Error("Pinned block changed; retry scan");
result.comments = [
  ...new Map(result.comments.map((c) => [c.id, c])).values(),
].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
// Keep last successful data if the provider fails on a later run.
const previous = (() => {
  try {
    return JSON.parse(readFileSync(outputFile, "utf8"));
  } catch {
    return null;
  }
})();
if (previous && result.scans.some((s) => s.status !== "indexed")) {
  result.comments = [
    ...new Map(
      [...previous.comments, ...result.comments].map((c) => [c.id, c]),
    ).values(),
  ];
  result.retainedPreviousComments = true;
}
writeFileSync(outputFile, JSON.stringify(result, null, 2));
console.log(
  `Saved ${result.comments.length} verified mint comments; ${result.comments.filter((c) => c.recordIds.length).length} match catalog tokens.`,
);
