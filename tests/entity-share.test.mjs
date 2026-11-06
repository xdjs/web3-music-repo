import test from "node:test";
import assert from "node:assert/strict";
import { entityShareURL, shareEntity } from "../src/entity-share.mjs";

test("public shares remove unrelated query and fragment state", () => {
  assert.equal(
    entityShareURL(
      "record",
      "song one",
      "https://music.example/?account=secret#me",
    ),
    "https://music.example/share/record/song%20one",
  );
  assert.throws(() =>
    entityShareURL("account", "private", "https://music.example"),
  );
  assert.throws(() => entityShareURL("record", "song", "javascript:alert(1)"));
});
test("share cancellation does not unexpectedly copy a link", async () => {
  const result = await shareEntity("artist", "pete-rango", "Pete Rango", {
    baseURL: "https://music.example",
    navigator: {
      share: async () => {
        throw Object.assign(new Error("cancel"), { name: "AbortError" });
      },
      clipboard: { writeText: () => assert.fail("must not copy") },
    },
  });
  assert.equal(result.status, "cancelled");
});
test("clipboard failure exposes a manual-copy fallback", async () => {
  const result = await shareEntity("playlist", "mix", "Mix", {
    baseURL: "https://music.example",
    navigator: {
      clipboard: {
        writeText: async () => {
          throw Error("denied");
        },
      },
    },
  });
  assert.equal(result.status, "manual");
  assert.equal(result.url, "https://music.example/share/playlist/mix");
});
