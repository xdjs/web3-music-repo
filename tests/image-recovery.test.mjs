import test from "node:test";
import assert from "node:assert/strict";
import { installImageRecovery } from "../src/image-recovery.mjs";
const original = "https://gateway.pinata.cloud/ipfs/QmTestImage/cover.png";
function setup(existing = []) {
  const listeners = new Set();
  const root = {
    addEventListener(type, callback, capture) {
      assert.equal(type, "error");
      assert.equal(capture, true);
      listeners.add(callback);
    },
    removeEventListener(type, callback) {
      listeners.delete(callback);
    },
    querySelectorAll: () => existing,
  };
  const error = (target) => {
    let stopped = false;
    for (const callback of listeners)
      callback({
        target,
        stopImmediatePropagation() {
          stopped = true;
        },
      });
    return stopped;
  };
  return { root, error, listeners };
}
test("image failures try each fixed same-CID gateway once then preserve the original error fallback", () => {
  const { root, error } = setup();
  const dispose = installImageRecovery(root);
  const image = { tagName: "IMG", src: original, alt: "Original artwork" };
  assert.equal(error(image), true);
  assert.equal(
    image.src,
    "https://ipfs.filebase.io/ipfs/QmTestImage/cover.png",
  );
  assert.equal(error(image), true);
  assert.equal(
    image.src,
    "https://magic.decentralized-content.com/ipfs/QmTestImage/cover.png",
  );
  assert.equal(error(image), false);
  assert.equal(error(image), false);
  assert.equal(image.alt, "Original artwork");
  dispose();
});
test("unrelated images, responsive sources and stale selection errors are untouched", () => {
  const { root, error } = setup();
  installImageRecovery(root);
  for (const extra of [
    { src: "https://example.com/image.png" },
    { src: "/people/pete.webp" },
    { srcset: "other.png 2x" },
    { parentElement: { tagName: "PICTURE" } },
    { currentSrc: "https://example.com/previous.png" },
  ]) {
    const image = { tagName: "IMG", src: original, ...extra },
      before = image.src;
    assert.equal(error(image), false);
    assert.equal(image.src, before);
  }
  const video = { tagName: "VIDEO", src: original };
  assert.equal(error(video), false);
});
test("a reused image gets a fresh finite sequence only for a new source", () => {
  const { root, error } = setup();
  installImageRecovery(root);
  const image = { tagName: "IMG", src: original };
  error(image);
  error(image);
  error(image);
  image.src = "https://gateway.pinata.cloud/ipfs/QmOtherImage";
  assert.equal(error(image), true);
  assert.match(image.src, /QmOtherImage$/);
});
test("installation is idempotent and cleanup detaches the shared listener", () => {
  const broken = {
    tagName: "IMG",
    src: original,
    complete: true,
    naturalWidth: 0,
  };
  const { root, listeners, error } = setup([broken]);
  const dispose = installImageRecovery(root);
  assert.match(broken.src, /ipfs.filebase.io/);
  assert.equal(installImageRecovery(root), dispose);
  assert.equal(listeners.size, 1);
  dispose();
  assert.equal(listeners.size, 0);
  assert.equal(error(broken), false);
});
