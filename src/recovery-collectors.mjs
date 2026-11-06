import { readLegacyCollectors } from "./legacy-collectors.mjs";
import {
  readHolders,
  readTokenHolders,
  readMediaHolders,
  holderMediaKey,
} from "./recovery-holders.mjs";
import { readOwner } from "./recovery-owner.mjs";
import { soundDeployments } from "../scripts/sound-contracts.mjs";
export function releaseRegistry(indexes) {
  const result = new Map();
  for (const index of indexes) {
    const d = soundDeployments[`${index.version}:${index.chainId}`];
    if (
      !d ||
      d.unit !== "release-contract" ||
      d.factory !== index.factory?.toLowerCase()
    )
      continue;
    for (const c of index.collections || []) {
      if (
        !/^0x[0-9a-f]{40}$/i.test(c.contract) ||
        !/^0x[0-9a-f]{64}$/i.test(c.transaction)
      )
        continue;
      result.set(`${index.chainId}:${c.contract.toLowerCase()}`, {
        factory: d.factory,
        transaction: c.transaction,
        createdBlock: c.createdBlock,
        version: index.version,
      });
    }
  }
  return result;
}
export async function readCollectors(
  record,
  cursor,
  registry,
  adapters = {
    readHolders,
    readOwner,
    readLegacyCollectors,
    readTokenHolders,
    readMediaHolders,
  },
) {
  if (record.standard === "ERC20")
    return {
      status: "unsupported",
      scope: "coin",
      items: [],
      message:
        "Coin-holder recovery is not implemented; NFT edition counts do not apply.",
    };
  if (
    record.factoryVersion === 0 &&
    record.legacyEditionId &&
    adapters.readLegacyCollectors
  ) {
    let next = cursor,
      result;
    const visited = new Set();
    for (let page = 0; page < 4; page++) {
      result = await adapters.readLegacyCollectors(record, next);
      if (
        result.status !== "indexed" ||
        result.items.length ||
        !result.nextCursor
      )
        return result;
      if (visited.has(result.nextCursor))
        return {
          status: "unavailable",
          scope: "legacy-release",
          message: "Repeated legacy index cursor",
        };
      visited.add(result.nextCursor);
      next = result.nextCursor;
    }
    return result;
  }
  if (record.standard === "ERC1155" && adapters.readTokenHolders)
    return adapters.readTokenHolders(record, cursor);
  const deployment = registry.get(
    `${record.chainId}:${record.contract.toLowerCase()}`,
  );
  if (deployment) {
    const v = await adapters.readHolders(record, cursor);
    return { ...v, scope: "release", deployment };
  }
  if (holderMediaKey(record.collectorMediaURI) && adapters.readMediaHolders) {
    const matched = await adapters.readMediaHolders(record, cursor);
    if (
      cursor ||
      (matched.status === "indexed" &&
        (matched.items?.length || matched.nextCursor))
    )
      return matched;
  }
  const owner = await adapters.readOwner(record);
  if (owner.status !== "verified")
    return { ...owner, scope: "token", items: [] };
  return {
    status: "indexed",
    scope: "token",
    items: [{ address: owner.address, balance: "1", tokenId: record.tokenId }],
    nextCursor: null,
    checkedAt: owner.checkedAt,
    blockNumber: owner.blockNumber,
    source: owner.source,
  };
}
