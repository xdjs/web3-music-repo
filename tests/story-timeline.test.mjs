import test from "node:test";
import assert from "node:assert/strict";
import {
  clipStart,
  timelineStart,
  keyboardStart,
  timeLabel,
} from "../src/story-timeline.mjs";
test("selection bounds preserve fixed fifteen seconds including fractional duration", () => {
  assert.equal(clipStart(-20, 240), 0);
  assert.equal(clipStart(999, 240.08), 225);
  assert.equal(clipStart(17.36, 240), 17.4);
});
test("pointer drag preserves grab offset while track click centers the selection", () => {
  const rect = { left: 100, width: 400 };
  assert.equal(timelineStart(300, rect, 240), 112.5);
  assert.equal(timelineStart(300, rect, 240, 3), 117);
  assert.equal(timelineStart(900, rect, 240), 225);
  assert.equal(timelineStart(0, rect, 240), 0);
});
test("keyboard selection is bounded and supports precise and accelerated movement", () => {
  assert.equal(keyboardStart("ArrowRight", 20, 240), 21);
  assert.equal(keyboardStart("ArrowLeft", 20, 240, true), 15);
  assert.equal(keyboardStart("End", 20, 240), 225);
  assert.equal(keyboardStart("Home", 20, 240), 0);
  assert.equal(keyboardStart("Tab", 20, 240), null);
});
test("time labels carry correctly at minute boundaries", () => {
  assert.equal(timeLabel(59.99), "1:00");
  assert.equal(timeLabel(103.5), "1:43.5");
});
