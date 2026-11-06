import test from "node:test";
import assert from "node:assert/strict";
import { createCollectorSearch } from "../src/collector-search-index.mjs";
const a = "0x1111111111111111111111111111111111111111",
  b = "0x2222222222222222222222222222222222222222";
const profiles = [
  {
    address: a,
    name: "Same Name",
    soundURL: "https://www.sound.xyz/alpha",
    capturedAt: "2023-01-01",
    source: "https://web.archive.org/example",
  },
  {
    address: b,
    name: "Same Name",
    soundURL: "https://www.sound.xyz/beta",
    capturedAt: "2023-02-01",
  },
  { address: a, name: "Old Alias", capturedAt: "2022-01-01" },
];
test("names remain ambiguous explicit addresses; exact addresses never trigger ENS", async () => {
  let calls = 0;
  const search = createCollectorSearch(profiles, () => {
    calls++;
    throw Error();
  });
  const names = await search("same name");
  assert.equal(names.items.length, 2);
  assert.equal(new Set(names.items.map((i) => i.address)).size, 2);
  assert.ok(names.items.every((i) => i.sourceType === "historical-sound"));
  assert.equal((await search("alpha")).items[0].address, a);
  assert.equal((await search(a)).items.length, 1);
  assert.equal((await search(a)).items[0].sourceType, "wallet-address");
  assert.equal(calls, 0);
});
test("ENS verified result is distinct from historical name; outages retain historical matches as partial", async () => {
  const p = [...profiles, { address: a, name: "person.eth" }];
  const search = createCollectorSearch(p, async (name) => ({
    status: "resolved",
    name,
    address: b,
    source: "https://app.ens.domains/" + name,
  }));
  const r = await search("person.eth");
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].address, b);
  assert.equal(r.items[0].sourceType, "ens");
  assert.equal(r.items[1].address, a);
  const failed = await createCollectorSearch(p, async () => {
    throw Error("provider");
  })("person.eth");
  assert.equal(failed.status, "partial");
  assert.equal(failed.items[0].address, a);
  assert.equal(failed.ens.status, "unavailable");
});
test("bounded results, duplicate address dedup, validation and pending ENS request dedup", async () => {
  const many = Array.from({ length: 25 }, (_, i) => ({
    address: "0x" + (i + 1).toString(16).padStart(40, "0"),
    name: "Common",
  }));
  const r = await createCollectorSearch(many)("common");
  assert.equal(r.items.length, 20);
  assert.equal(r.total, 25);
  assert.equal(r.truncated, true);
  assert.equal((await createCollectorSearch(profiles)("x")).status, "invalid");
  assert.equal(
    (await createCollectorSearch(profiles)("a\nname")).status,
    "invalid",
  );
  let calls = 0;
  const search = createCollectorSearch([], async (name) => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return { status: "resolved", name, address: a };
  });
  await Promise.all([search("ok.eth"), search("OK.ETH")]);
  assert.equal(calls, 1);
});
