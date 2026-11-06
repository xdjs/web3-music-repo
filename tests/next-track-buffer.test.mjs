import test from "node:test";
import assert from "node:assert/strict";
import {
  createNextTrackBuffer,
  hasPlaybackHeadroom,
} from "../src/next-track-buffer.mjs";
const a = {
  id: "a",
  url: "https://media.example/a.mp3",
  kind: "audio",
  contextId: "playing",
};
function setup() {
  const doc = new EventTarget();
  doc.hidden = false;
  const connection = new EventTarget();
  connection.effectiveType = "4g";
  const nav = { onLine: true, connection },
    events = new EventTarget(),
    media = [],
    timers = new Map();
  let seq = 0,
    warming = true,
    time = 0;
  const make = () => {
    const m = new EventTarget();
    Object.assign(m, {
      src: "",
      preload: "none",
      paused: true,
      error: null,
      duration: 180,
      buffered: {
        length: 0,
        start() {
          return 0;
        },
        end() {
          return m.seconds;
        },
      },
      seconds: 0,
      loads: 0,
      plays: 0,
      load() {
        this.loads++;
      },
      pause() {
        this.paused = true;
      },
      play() {
        this.plays++;
      },
      removeAttribute() {
        this.src = "";
      },
    });
    media.push(m);
    return m;
  };
  const buffer = createNextTrackBuffer({
    createMedia: make,
    canWarm: () => warming,
    document: doc,
    navigator: nav,
    events,
    now: () => time,
    setTimer: (f, ms) => {
      timers.set(++seq, { f, ms });
      return seq;
    },
    clearTimer: (id) => timers.delete(id),
  });
  const tick = (ms) => {
    for (const [id, t] of [...timers])
      if (t.ms === ms) {
        timers.delete(id);
        t.f();
      }
  };
  const ready = () => {
    const m = media.at(-1);
    m.seconds = 10;
    m.buffered.length = 1;
    m.dispatchEvent(new Event("progress"));
    return m;
  };
  return {
    buffer,
    doc,
    nav,
    events,
    media,
    tick,
    ready,
    warming: (v) => (warming = v),
    time: (v) => (time = v),
  };
}
test("one native standby buffers next audio without playing and is adopted unchanged", () => {
  const s = setup();
  assert.ok(s.buffer.schedule(a));
  assert.equal(s.media.length, 0);
  s.tick(700);
  const m = s.ready();
  assert.equal(m.plays, 0);
  assert.equal(m.preload, "none");
  assert.equal(s.buffer.state().ready, true);
  assert.equal(s.buffer.take("a", a.url), m);
  assert.equal(m.src, a.url);
  assert.equal(m.loads, 1);
  assert.equal(m.preload, "auto");
  s.tick(20000);
  assert.equal(m.src, a.url);
  assert.equal(s.buffer.state(), null);
});
test("Next before target buffer reuses an in-flight element without restarting its request", () => {
  const s = setup();
  s.buffer.schedule(a);
  s.tick(700);
  const m = s.media[0];
  assert.equal(s.buffer.take(a.id, a.url), m);
  assert.equal(m.loads, 1);
});
test("queue/source/context changes cancel previous pending asset and ignore late events", () => {
  const s = setup();
  s.buffer.schedule(a);
  s.tick(700);
  const old = s.media[0];
  s.buffer.schedule({ ...a, id: "b", url: "https://media.example/b.mp3" });
  assert.equal(old.src, "");
  s.tick(700);
  old.dispatchEvent(new Event("progress"));
  assert.equal(s.buffer.state().id, "b");
  assert.equal(s.buffer.state().ready, false);
  assert.equal(s.media.filter((m) => m.src).length, 1);
  s.buffer.schedule({
    ...a,
    id: "b",
    url: "https://media.example/changed.mp3",
  });
  assert.equal(s.media[1].src, "");
});
test("deadline and media errors cancel failed loads with no repeated retry loop", () => {
  for (const fail of [
    (s) => s.tick(20000),
    (s) => s.media[0].dispatchEvent(new Event("error")),
  ]) {
    const s = setup();
    s.buffer.schedule(a);
    s.tick(700);
    fail(s);
    assert.equal(s.media[0].src, "");
    assert.equal(s.buffer.state(), null);
    assert.equal(s.buffer.schedule(a), false);
  }
});
test("pause cancels an incomplete load but retains ready buffer without starting new work", () => {
  const s = setup();
  s.buffer.schedule(a);
  s.tick(700);
  s.warming(false);
  s.buffer.suspend();
  assert.equal(s.media[0].src, "");
  const t = setup();
  t.buffer.schedule(a);
  t.tick(700);
  const m = t.ready();
  t.warming(false);
  t.buffer.suspend();
  assert.equal(m.src, a.url);
  assert.equal(m.preload, "none");
  assert.equal(t.buffer.take(a.id, a.url), m);
});
test("visibility/offline/save-data/slow connection policy suppresses and cancels warming", () => {
  for (const change of [
    (s) => (s.doc.hidden = true),
    (s) => (s.nav.onLine = false),
    (s) => (s.nav.connection.saveData = true),
    (s) => (s.nav.connection.effectiveType = "3g"),
  ]) {
    const s = setup();
    change(s);
    assert.equal(s.buffer.schedule(a), false);
    const t = setup();
    t.buffer.schedule(a);
    t.tick(700);
    change(t);
    t.doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(t.media[0].src, "");
  }
});
test("video, invalid URLs, changed adoption source and disposed state fail safely", () => {
  const s = setup();
  for (const value of [
    { ...a, kind: "video" },
    { ...a, url: "javascript:bad" },
    { ...a, url: "https://name:secret@host/a" },
  ])
    assert.equal(s.buffer.schedule(value), false);
  s.buffer.schedule(a);
  s.tick(700);
  assert.equal(s.buffer.take(a.id, "https://media.example/changed"), null);
  s.buffer.dispose();
  assert.equal(s.buffer.schedule({ ...a, id: "b" }), false);
});
test("rapid queue changes are debounced and constrained to four starts per minute", () => {
  const s = setup();
  s.buffer.schedule(a);
  s.buffer.schedule({ ...a, id: "b" });
  assert.equal(s.media.length, 0);
  s.tick(700);
  assert.equal(s.media.length, 1);
  for (let i = 0; i < 3; i++) {
    s.buffer.schedule({ ...a, id: String(i) });
    s.tick(700);
  }
  assert.equal(s.buffer.schedule({ ...a, id: "limit" }), false);
  assert.equal(s.media.length, 4);
  s.time(61000);
  assert.equal(s.buffer.schedule({ ...a, id: "after" }), true);
});

test("current playback requires contiguous ten-second headroom or fully buffered short remainder", () => {
  const media = {
    paused: false,
    readyState: 3,
    currentTime: 30,
    duration: 90,
    buffered: {
      length: 2,
      start: (i) => (i ? 50 : 0),
      end: (i) => (i ? 90 : 35),
    },
  };
  assert.equal(hasPlaybackHeadroom(media), false);
  media.buffered.end = (i) => (i ? 90 : 40);
  assert.equal(hasPlaybackHeadroom(media), true);
  media.currentTime = 85;
  assert.equal(hasPlaybackHeadroom(media), true);
  media.paused = true;
  assert.equal(hasPlaybackHeadroom(media), false);
  media.paused = false;
  media.readyState = 2;
  assert.equal(hasPlaybackHeadroom(media), false);
});

test("interrupted and failed preload can retry after recovery, with a strict attempt cap", () => {
  const s = setup();
  for (let attempt = 0; attempt < 3; attempt++) {
    s.time(attempt * 6000);
    assert.equal(s.buffer.schedule(a), true);
    s.tick(700);
    s.warming(false);
    s.buffer.suspend();
    s.warming(true);
    assert.equal(s.buffer.schedule(a), false);
  }
  s.time(61000);
  assert.equal(s.buffer.schedule(a), false);
  assert.equal(s.media.length, 3);
  assert.equal(s.media.filter((m) => m.src).length, 0);
});
