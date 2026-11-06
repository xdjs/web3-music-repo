import test from "node:test";
import assert from "node:assert/strict";
import { soundDeployment, decodeFactoryEvent } from "./sound-contracts.mjs";
const address = (n) => "0x" + n.repeat(40);
const topicAddress = (n) => "0x" + "0".repeat(24) + n.repeat(40);
test("factory and event are both required; V2 uses edition not implementation", () => {
  const d = soundDeployment(2, 10);
  const e = {
    address: { hash: d.factory },
    topics: [d.topic, topicAddress("a"), topicAddress("b"), topicAddress("c")],
    block_number: 123,
  };
  assert.equal(decodeFactoryEvent(e, d).contract, address("b"));
  assert.equal(
    decodeFactoryEvent({ ...e, address: { hash: address("d") } }, d),
    null,
  );
  assert.equal(
    decodeFactoryEvent({ ...e, topics: ["0x00", ...e.topics.slice(1)] }, d),
    null,
  );
  assert.equal(
    decodeFactoryEvent(
      { ...e, topics: [d.topic, topicAddress("a"), "0x123"] },
      d,
    ),
    null,
  );
});
test("legacy artist proxy and V1 creator use first indexed address with different semantics", () => {
  for (const version of [0, 1]) {
    const d = soundDeployment(version, 1);
    const e = {
      address: { hash: d.factory.toUpperCase().replace("0X", "0x") },
      topics: [d.topic, topicAddress("b"), topicAddress("c")],
    };
    assert.equal(decodeFactoryEvent(e, d).contract, address("b"));
    assert.equal(
      decodeFactoryEvent(e, d).unit,
      version === 0 ? "artist-contract" : "release-contract",
    );
  }
  assert.notEqual(
    soundDeployment(1, 1).factory,
    soundDeployment(1, 10).factory,
  );
  assert.throws(() => soundDeployment(0, 10));
  assert.throws(() => soundDeployment(1, 8453));
});
