import test from "node:test";
import assert from "node:assert/strict";
import { createHomeSelection } from "../src/home-selection.mjs";
test("homepage stays stable during navigation; next visit changes hero and artist row", () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k),
    setItem: (k, v) => values.set(k, v),
  };
  const heroes = ["one", "two", "three"],
    artists = Array.from({ length: 20 }, (_, i) => "artist-" + i);
  const select = createHomeSelection(storage, () => 0.5),
    first = select(heroes, artists);
  assert.equal(select(heroes, artists), first);
  assert.equal(new Set(first.artistIds).size, 7);
  const next = createHomeSelection(storage, () => 0.5)(heroes, artists);
  assert.notEqual(next.heroId, first.heroId);
  assert.equal(
    next.artistIds.some((id) => first.artistIds.includes(id)),
    false,
  );
});
test("rotation tolerates unavailable or corrupt browser storage and short pools", () => {
  for (const storage of [
    { getItem: () => "{", setItem: () => {} },
    {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    },
  ]) {
    const selection = createHomeSelection(storage)(["one"], ["a", "a", "b"]);
    assert.equal(selection.heroId, "one");
    assert.equal(selection.artistIds.length, 2);
  }
});
