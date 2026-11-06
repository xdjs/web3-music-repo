import test from "node:test";
import assert from "node:assert/strict";
import { createMediaPreloader } from "../src/media-preload.mjs";
function setup(options = {}) {
  const media = new EventTarget();
  Object.assign(media, {
    src: "",
    paused: true,
    error: null,
    loads: 0,
    load() {
      this.loads++;
    },
    removeAttribute() {
      this.src = "";
    },
  });
  const doc = new EventTarget();
  doc.hidden = false;
  const connection = new EventTarget();
  connection.effectiveType = "4g";
  const nav = { onLine: true, connection };
  const timers = new Map();
  let seq = 0,
    busy = false;
  const p = createMediaPreloader(media, {
    document: doc,
    navigator: nav,
    isBusy: () => busy,
    setTimer: (f, ms) => {
      timers.set(++seq, { f, ms });
      return seq;
    },
    clearTimer: (id) => timers.delete(id),
    ...options,
  });
  const tick = (ms) => {
    for (const [id, t] of [...timers])
      if (t.ms === ms) {
        timers.delete(id);
        t.f();
      }
  };
  return { media, doc, nav, p, tick, busy: (v) => (busy = v) };
}
const a = { id: "a", url: "https://arweave.net/original", kind: "audio" };
test("same-player metadata is reused without resetting src or load", () => {
  const { p, tick, media } = setup();
  assert.ok(p.schedule(a));
  tick(650);
  media.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(p.state().ready, true);
  assert.ok(p.take(a.id, a.url));
  assert.equal(media.loads, 1);
  assert.equal(media.src, a.url);
  assert.equal(p.state(), null);
  tick(2000);
  assert.equal(media.src, a.url);
});
test("deadline cancels incomplete request; subsequent play must reload normally", () => {
  const { p, tick, media } = setup();
  p.schedule(a);
  tick(650);
  tick(2000);
  assert.equal(media.src, "");
  assert.equal(p.take(a.id, a.url), false);
});
test("never warms video, unsafe URL, slow/saved/offline/hidden, or occupied player", () => {
  for (const mutate of [
    (x) => (x.doc.hidden = true),
    (x) => (x.nav.onLine = false),
    (x) => (x.nav.connection.saveData = true),
    (x) => (x.nav.connection.effectiveType = "3g"),
    (x) => x.busy(true),
    (x) => (x.media.paused = false),
  ]) {
    const s = setup();
    mutate(s);
    assert.equal(s.p.schedule(a), false);
  }
  const s = setup();
  for (const c of [
    { ...a, kind: "video" },
    { ...a, url: "http://a.test/a" },
    { ...a, url: "https://u:p@a.test/a" },
    { ...a, url: "https://a.test:123/a" },
  ])
    assert.equal(s.p.schedule(c), false);
});
test("one candidate and at most two starts per minute", () => {
  const { p, tick, media } = setup();
  p.schedule(a);
  assert.equal(p.schedule({ ...a, id: "b" }), false);
  tick(650);
  p.cancel();
  p.schedule(a);
  tick(650);
  p.cancel();
  assert.equal(p.schedule(a), false);
  assert.equal(media.loads, 4);
});
test("visibility change cancels only owned idle media, never active playback", () => {
  const s = setup();
  s.p.schedule(a);
  s.tick(650);
  s.doc.hidden = true;
  s.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(s.media.src, "");
  const t = setup();
  t.p.schedule(a);
  t.tick(650);
  t.busy(true);
  t.media.paused = false;
  t.media.dispatchEvent(new Event("play"));
  t.p.cancel();
  assert.equal(t.media.src, a.url);
});
test("different play candidate releases warm source; disposed cannot restart", () => {
  const { p, tick, media } = setup();
  p.schedule(a);
  tick(650);
  assert.equal(p.take("b", "https://arweave.net/other"), false);
  assert.equal(media.src, "");
  p.dispose();
  assert.equal(p.schedule(a), false);
});
