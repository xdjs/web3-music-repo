import test from "node:test";
import assert from "node:assert/strict";
import {
  alternateMediaURL,
  alternateMediaURLs,
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
test("bounded gateway fallbacks ignore stale failures and exhaust without loops", async () => {
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
  media.dispatchEvent(new Event("error"));
  assert.equal(switches, 2);
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

test("fallbacks keep the CID, file path and query but never trust credentials or foreign hosts", () => {
  const url = original + "?download=1";
  const candidates = alternateMediaURLs(url);
  assert.equal(candidates.length, 2);
  assert.equal(
    candidates[1],
    "https://magic.decentralized-content.com/ipfs/bafytest/song.wav?download=1",
  );
  for (const candidate of candidates) {
    assert.equal(new URL(candidate).pathname, new URL(url).pathname);
    assert.equal(new URL(candidate).search, new URL(url).search);
  }
  for (const invalid of [
    "https://user:pass@ipfs.filebase.io/ipfs/bafytest/x",
    "https://ipfs.filebase.io:8443/ipfs/bafytest/x",
    "https://ipfs.filebase.io.evil.test/ipfs/bafytest/x",
    "https://ipfs.filebase.io/ipfs/bafytest/../other",
    "https://ipfs.filebase.io/ipfs/bafytest/%2e%2e/other",
    "https://ipfs.filebase.io/ipfs/bafytest/%2f../other",
    "https://ipfs.filebase.io/ipfs/bafytest/%ZZ",
    "http://127.0.0.1/ipfs/bafytest/x",
  ])
    assert.deepEqual(alternateMediaURLs(invalid), []);
});

test("disposing fallback removes pending seeks and prevents delayed playback failures from restarting", async () => {
  const media = new EventTarget();
  let rejectPlay;
  Object.assign(media, {
    src: original,
    currentTime: 12,
    load() {},
    play: () =>
      new Promise((_, reject) => {
        rejectPlay = reject;
      }),
  });
  let switches = 0,
    failures = 0;
  const recovery = createMediaRecovery(media, {
    originalURL: original,
    shouldPlay: () => true,
    onSwitch: () => switches++,
    onExhausted: () => failures++,
  });
  recovery.recover();
  recovery.dispose();
  media.currentTime = 0;
  media.dispatchEvent(new Event("loadedmetadata"));
  rejectPlay(new Error("network"));
  await Promise.resolve();
  assert.equal(media.currentTime, 0);
  assert.equal(switches, 1);
  assert.equal(failures, 0);
});

test("Arweave tries one same-transaction gateway then keeps the last slow request alive", () => {
  const media = new EventTarget();
  const url = "https://arweave.net/a4b8Spd5rcouKzttmYQnToH_d6nW6Sc-dMY2bHvpTW4";
  let failures = 0,
    slow = 0,
    switches = 0;
  Object.assign(media, {
    src: url,
    currentTime: 0,
    error: null,
    load() {},
    play: async () => {},
  });
  const recovery = createMediaRecovery(media, {
    originalURL: url,
    shouldPlay: () => true,
    onSwitch: () => switches++,
    onExhausted: () => failures++,
    onSlow: () => slow++,
  });
  recovery.recoverSlow();
  assert.equal(media.src, url.replace("arweave.net", "turbo-gateway.com"));
  assert.equal(recovery.recoverSlow(), "waiting");
  assert.equal(failures, 0);
  assert.equal(slow, 1);
  assert.equal(switches, 1);
  // The last same-transaction request may finish after its deadline.
  media.currentTime = 1.5;
  media.dispatchEvent(new Event("playing"));
  assert.equal(failures, 0);
  recovery.dispose();
});

test("a real media error still exhausts after a slow-load notice", () => {
  const media = new EventTarget();
  const url = "https://arweave.net/recording";
  let failures = 0;
  Object.assign(media, { src: url, currentTime: 0, error: null });
  const recovery = createMediaRecovery(media, {
    originalURL: url,
    shouldPlay: () => true,
    onSwitch() {},
    onExhausted: () => failures++,
  });
  recovery.recoverSlow();
  assert.equal(failures, 0);
  media.error = { code: 2 };
  media.dispatchEvent(new Event("error"));
  assert.equal(failures, 1);
  media.dispatchEvent(new Event("error"));
  assert.equal(failures, 1);
  recovery.dispose();
});

test("soft deadlines advance finite IPFS alternates but keep the last pending request alive", () => {
  const media = new EventTarget();
  let failures = 0,
    switches = 0,
    slow = 0;
  Object.assign(media, {
    src: original,
    currentTime: 0,
    error: null,
    load() {},
    play: async () => {},
  });
  const recovery = createMediaRecovery(media, {
    originalURL: original,
    shouldPlay: () => true,
    onSwitch: () => switches++,
    onExhausted: () => failures++,
    onSlow: () => slow++,
  });
  recovery.recoverSlow();
  recovery.recoverSlow();
  recovery.recoverSlow();
  assert.equal(switches, 2);
  assert.equal(slow, 1);
  assert.equal(failures, 0);
  recovery.recover();
  assert.equal(failures, 1);
  recovery.dispose();
});

test("Arweave fallback preserves exact transaction, manifest path and query through fixed gateways", () => {
  const tx = "YStvDur7I86UT_qwjo2NGC4ccu5GiMybEN8VavqGTdw";
  assert.deepEqual(alternateMediaURLs(`https://arweave.net/${tx}?ext=mp3`), [
    `https://turbo-gateway.com/${tx}?ext=mp3`,
  ]);
  assert.deepEqual(
    alternateMediaURLs(`https://www.arweave.net/${tx}/track.wav?download=1`),
    [
      `https://turbo-gateway.com/${tx}/track.wav?download=1`,
      `https://arweave.net/${tx}/track.wav?download=1`,
    ],
  );
  assert.deepEqual(alternateMediaURLs(`https://turbo-gateway.com/${tx}`), [
    `https://arweave.net/${tx}`,
  ]);
  const sandbox = "a".repeat(52);
  assert.equal(
    alternateMediaURLs(`https://${sandbox}.arweave.net/${tx}`)[0],
    `https://turbo-gateway.com/${tx}`,
  );
  for (const value of [
    `https://evil.test/${tx}`,
    `https://arweave.net.evil.test/${tx}`,
    `https://arweave.net/graphql`,
    `https://arweave.net/${tx}/../other`,
    `https://arweave.net/${tx}/%2e%2e/other`,
    `https://arweave.net/${tx}/%2fother`,
    `https://user@arweave.net/${tx}`,
    `https://arweave.net:8443/${tx}`,
    `https://name.arweave.net/${tx}`,
    `https://arweave.net/${tx}/%ZZ`,
  ])
    assert.deepEqual(alternateMediaURLs(value), [], value);
});
