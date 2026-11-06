// Only factory deployments corroborated by official source and explorer-verified code.
const v1Topic =
  "0x405098db99342b699216d8150e930dbbf2f686f5a43485aed1e69219dafd4935";
const v2Topic =
  "0xe94db3a31c09b7894f023c1f9114859672be916ffa8282215d7d43595bdcb3e7";
export const soundDeployments = {
  "0:1": {
    factory: "0x78e3adc0e811e4f93bd9f1f9389b923c9a3355c2",
    topic: "0x23748b43b77f98380e738976c6324996908ffc1989994dd3c68631c87a65a7c0",
    addressTopic: 1,
    unit: "artist-contract",
    source:
      "https://github.com/soundxyz/protocol/blob/master/contracts/ArtistCreatorV2.sol",
    verification:
      "https://eth.blockscout.com/api/v2/smart-contracts/0x5912eb98dcc819894aae9e06f5fb6a3bec459346",
  },
  "1:1": {
    factory: "0xaef3e8c8723d9c31863be8de54df2668ef7c4b89",
    topic: v1Topic,
    addressTopic: 1,
    unit: "release-contract",
    source:
      "https://github.com/soundxyz/sound-protocol/blob/main/broadcast/Deploy.s.sol/1/run-latest.json",
  },
  "1:10": {
    factory: "0x5bcf5773bcf1f131a0cad5c74aa9be1a80b63c55",
    topic: v1Topic,
    addressTopic: 1,
    unit: "release-contract",
    source:
      "https://github.com/soundxyz/sound-protocol/blob/main/contracts/core/SoundCreatorV1.sol",
    verification:
      "https://optimism.blockscout.com/api/v2/smart-contracts/0x5bcf5773bcf1f131a0cad5c74aa9be1a80b63c55",
  },
  "2:1": {
    factory: "0x0000000000aec84f5bfc2af15eafb943bf4e3522",
    topic: v2Topic,
    addressTopic: 2,
    unit: "release-contract",
    source: "https://github.com/soundxyz/sound-protocol/blob/main/README.md",
  },
  "2:10": {
    factory: "0x0000000000aec84f5bfc2af15eafb943bf4e3522",
    topic: v2Topic,
    addressTopic: 2,
    unit: "release-contract",
    source: "https://github.com/soundxyz/sound-protocol/blob/main/README.md",
  },
};
export function soundDeployment(version, chainId) {
  const deployment = soundDeployments[`${version}:${chainId}`];
  if (!deployment) throw Error("Unverified factory deployment");
  return deployment;
}
export function decodeFactoryEvent(event, deployment) {
  if (
    event.address?.hash?.toLowerCase() !== deployment.factory ||
    event.topics?.[0] !== deployment.topic
  )
    return null;
  const value = event.topics[deployment.addressTopic];
  if (!/^0x0{24}[0-9a-f]{40}$/i.test(value || "")) return null;
  const contract = "0x" + value.slice(-40).toLowerCase();
  if (/^0x0{40}$/.test(contract)) return null;
  return {
    contract,
    unit: deployment.unit,
    createdBlock: event.block_number,
    blockHash: event.block_hash,
    transaction: event.transaction_hash,
    createdAt: event.block_timestamp,
  };
}
