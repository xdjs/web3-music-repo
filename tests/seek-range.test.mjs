import test from "node:test";
import assert from "node:assert/strict";
import { bindSeekRange } from "../src/now-playing.mjs";
class Range extends EventTarget {
  value = "0";
  fire(type) {
    this.dispatchEvent(new Event(type));
  }
}
test("drag previews intermediate values and commits a single seek on release", () => {
  const input = new Range(),
    committed = [],
    previews = [];
  const control = bindSeekRange(input, {
    commit: (value) => committed.push(value),
    preview: (value) => previews.push(value),
  });
  input.fire("pointerdown");
  for (const value of [100, 250, 430]) {
    input.value = String(value);
    input.fire("input");
  }
  assert.deepEqual(committed, []);
  assert.equal(control.sync(5), 430);
  assert.equal(input.value, "430");
  input.fire("change");
  assert.deepEqual(committed, [430]);
  assert.deepEqual(previews, [100, 250, 430]);
  assert.equal(control.sync(431), null);
  assert.equal(input.value, 431);
});
test("cancelled gesture never seeks; keyboard change and bounds work", () => {
  const input = new Range(),
    committed = [];
  const control = bindSeekRange(input, {
    commit: (value) => committed.push(value),
  });
  input.value = "700";
  input.fire("input");
  input.fire("pointercancel");
  control.sync(20);
  assert.deepEqual(committed, []);
  assert.equal(input.value, 20);
  input.value = "200";
  input.fire("input");
  input.fire("change");
  input.value = "1200";
  input.fire("input");
  input.fire("change");
  assert.deepEqual(committed, [200, 1000]);
});
