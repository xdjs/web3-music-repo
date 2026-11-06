import test from "node:test";
import assert from "node:assert/strict";
import {
  alternateMediaURL,
  createMediaRecovery,
} from "../src/media-recovery.js";
const original = "https://ipfs.filebase.io/ipfs/bafytest/song.wav";
test("fallback preserves IPFS path and query and rejects non-IPFS hosts", () => {
  assert.equal(
    alternateMediaURL(original + "?version=1"),
    "https://gateway.pinata.cloud/ipfs/bafytest/song.wav?version=1",
  );
  for (const value of [
    "http://ipfs.filebase.io/ipfs/test",
    "https://evil.test/ipfs/test",
    "https://arweave.net/test",
    "invalid",
  ])
    assert.equal(alternateMediaURL(value), null);
});
test("one fallback ignores a stale play rejection and then exhausts without loops", async () => {
  const media = new EventTarget();
  Object.assign(media, {
    src: original,
    currentTime: 0,
    load() {},
    play: async () => {},
  });
  let switches = 0,
    failures = 0;
  const recovery = createMediaRecovery(media, {
    originalURL: original,
    shouldPlay: () => true,
    onSwitch: () => switches++,
    onExhausted: () => failures++,
  });
  recovery.recover(original);
  recovery.recover(original);
  assert.equal(switches, 1);
  assert.equal(failures, 0);
  media.dispatchEvent(new Event("error"));
  media.dispatchEvent(new Event("error"));
  assert.equal(failures, 1);
  recovery.dispose();
});
test("pause intent prevents retry autoplay and disposal cancels recovery", () => {
  const media = new EventTarget();
  let plays = 0;
  Object.assign(media, {
    src: original,
    currentTime: 0,
    load() {},
    play: async () => {
      plays++;
    },
  });
  const recovery = createMediaRecovery(media, {
    originalURL: original,
    shouldPlay: () => false,
    onSwitch() {},
    onExhausted() {},
  });
  recovery.recover();
  assert.equal(plays, 0);
  recovery.dispose();
  media.dispatchEvent(new Event("error"));
  assert.equal(plays, 0);
});
