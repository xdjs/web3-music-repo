import test from "node:test";
import assert from "node:assert/strict";
import {
  selectDirectoryArtist,
  readDirectoryArtist,
} from "../src/directory.js";

const identity = {
  name: "Dutchyyy",
  id: "efff5473-fa9f-4eba-b137-16ffb79f15d8",
  field: "bandcamp",
  value: "dutchmassive",
};
const row = {
  id: identity.id,
  name: identity.name,
  bandcamp: "dutchmassive",
  isExternalOnly: false,
  bio: "PRIVATE",
  wallet: "PRIVATE",
  lore: "PRIVATE",
};

test("requires the pinned identity and independent reference, then allowlists output", () => {
  assert.deepEqual(selectDirectoryArtist({ results: [row] }, identity), {
    id: row.id,
    name: row.name,
    url: `https://musicnerd.net/artist/${row.id}`,
  });
  assert.equal(
    selectDirectoryArtist(
      { results: [{ ...row, bandcamp: "wrong" }] },
      identity,
    ),
    null,
  );
  assert.equal(
    selectDirectoryArtist({ results: [{ ...row, id: "other" }] }, identity),
    null,
  );
  assert.equal(
    selectDirectoryArtist(
      { results: [{ ...row, isExternalOnly: true }] },
      identity,
    ),
    null,
  );
  assert.equal(
    selectDirectoryArtist({ results: [{ ...row, id: null }] }, identity),
    null,
  );
  assert.equal(selectDirectoryArtist({ results: "bad" }, identity), null);
});

test("failed requests return an explicit unavailable state, not an empty successful result", async () => {
  const result = await readDirectoryArtist(identity, async () => ({
    ok: false,
    status: 503,
  }));
  assert.equal(result.status, "unavailable");
  const mismatch = await readDirectoryArtist(identity, async () => ({
    ok: true,
    json: async () => ({ results: [] }),
  }));
  assert.equal(mismatch.status, "unconfirmed");
});

test("aborted upstream lookup remains unavailable", async () => {
  const result = await readDirectoryArtist(identity, async () => {
    throw new DOMException("timeout", "AbortError");
  });
  assert.equal(result.status, "unavailable");
});
