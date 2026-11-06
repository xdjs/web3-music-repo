import test from "node:test";
import assert from "node:assert/strict";
import {
  moments,
  people,
  relationships,
  sources,
  chapter,
  identities,
} from "../src/data.js";
test("all navigation and evidence edges resolve; people IDs are unique", () => {
  const ids = new Set(moments.map((m) => m.id)),
    pids = new Set(people.map((p) => p.id));
  assert.equal(pids.size, people.length);
  assert.equal(ids.size, moments.length);
  for (const id of chapter) assert.ok(ids.has(id));
  for (const m of moments) {
    for (const id of m.related) assert.ok(ids.has(id), id);
    for (const id of m.people) assert.ok(pids.has(id), id);
    for (const id of m.sources) assert.ok(sources[id], id);
    assert.ok(m.date);
  }
  for (const r of relationships) {
    assert.ok(pids.has(r.from));
    assert.ok(pids.has(r.to));
    assert.ok(ids.has(r.moment));
    assert.ok(sources[r.source]);
    assert.ok(r.type && r.note);
  }
  for (const source of Object.values(sources))
    assert.equal(new URL(source.url).protocol, "https:");
  for (const id of Object.keys(identities)) assert.ok(pids.has(id));
});
test("every foregrounded connection carries evidence and uncertainty is retained", () => {
  assert.ok(
    relationships.some(
      (r) =>
        r.from === "sound-of-fractures" &&
        r.to === "three-oscillators" &&
        r.source === "remixes",
    ),
  );
  assert.ok(moments.find((m) => m.id === "chaos").uncertainty);
  assert.ok(moments.find((m) => m.id === "sound").uncertainty);
  assert.ok(!relationships.some((r) => r.type === "Friendship"));
});

test("person context and external links retain resolvable public evidence", () => {
  for (const person of people) {
    assert.ok(person.bio, person.id);
    assert.ok(person.sources.length, person.id);
    for (const id of person.sources)
      assert.ok(sources[id], `${person.id}: ${id}`);
    for (const link of person.links || []) {
      const url = new URL(link.url);
      assert.equal(url.protocol, "https:");
      assert.equal(url.username, "");
      assert.equal(url.password, "");
    }
  }
});
