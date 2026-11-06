// A queue occurrence has its own key: duplicate recording IDs remain distinct.
// History/current stay in place; only unplayed entries change when toggled.
const finish = (state, entries, index = state.index, mode = state.mode) => ({
  ...state,
  entries,
  ids: entries.map((entry) => entry.id),
  index,
  mode,
});
export function createShuffleQueue(enabled = false) {
  return {
    ids: [],
    entries: [],
    originalOrder: [],
    index: -1,
    mode: null,
    enabled: Boolean(enabled),
    nextKey: 0,
    pendingShuffle: false,
  };
}
export function toggleQueueShuffle(
  state,
  enabled = !state.enabled,
  random = Math.random,
) {
  enabled = Boolean(enabled);
  if (enabled === state.enabled) return state;
  const split = Math.max(0, state.index + 1),
    past = state.entries.slice(0, split),
    upcoming = state.entries.slice(split);
  if (enabled) {
    for (let i = upcoming.length - 1; i > 0; i--) {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1)
        throw new RangeError("Shuffle random must be in [0, 1)");
      const j = Math.floor(value * (i + 1));
      [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
    }
  } else {
    const positions = new Map(
      state.originalOrder.map((key, index) => [key, index]),
    );
    upcoming.sort((a, b) => positions.get(a.key) - positions.get(b.key));
  }
  return finish({ ...state, enabled, pendingShuffle: false }, [
    ...past,
    ...upcoming,
  ]);
}
export function replaceShuffleQueue(
  state,
  ids,
  index,
  mode = "manual",
  random = Math.random,
) {
  const entries = ids.map((id, i) => ({ id, key: state.nextKey + i }));
  const next = finish(
    {
      ...state,
      enabled: false,
      pendingShuffle: false,
      originalOrder: entries.map((e) => e.key),
      nextKey: state.nextKey + entries.length,
    },
    entries,
    index,
    mode,
  );
  return state.enabled ? toggleQueueShuffle(next, true, random) : next;
}
export function selectShuffledTrack(
  state,
  id,
  context = [],
  explicit = null,
  index = null,
  random = Math.random,
) {
  // Next/Previous/queue row selection use the same array, preserving one shuffle.
  if (explicit === state.ids && state.pendingShuffle)
    return replaceShuffleQueue(
      state,
      state.ids,
      index ?? state.ids.indexOf(id),
      state.mode,
      random,
    );
  if (explicit === state.ids)
    return finish(state, state.entries, index ?? state.ids.indexOf(id));
  if (explicit)
    return replaceShuffleQueue(
      state,
      [...explicit],
      index ?? explicit.indexOf(id),
      "manual",
      random,
    );
  if (!state.ids.length || state.mode !== "manual") {
    const ids = [...new Set(context.includes(id) ? context : [id, ...context])];
    return replaceShuffleQueue(state, ids, ids.indexOf(id), "auto", random);
  }
  const found = state.ids.indexOf(id);
  if (found >= 0) return finish(state, state.entries, found, "manual");
  const next = Math.max(0, state.index + 1),
    entry = { id, key: state.nextKey };
  const entries = [...state.entries];
  entries.splice(next, 0, entry);
  const order = [...state.originalOrder],
    currentKey = state.entries[state.index]?.key;
  order.splice(
    currentKey === undefined ? 0 : order.indexOf(currentKey) + 1,
    0,
    entry.key,
  );
  return finish(
    { ...state, nextKey: state.nextKey + 1, originalOrder: order },
    entries,
    next,
    "manual",
  );
}
export function appendShuffleQueue(state, id) {
  const entry = { id, key: state.nextKey };
  return finish(
    {
      ...state,
      nextKey: state.nextKey + 1,
      originalOrder: [...state.originalOrder, entry.key],
      pendingShuffle:
        state.pendingShuffle || (state.enabled && !state.entries.length),
    },
    [...state.entries, entry],
    state.index,
    "manual",
  );
}
export function removeShuffleQueue(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.entries.length)
    return state;
  const key = state.entries[index].key;
  return finish(
    { ...state, originalOrder: state.originalOrder.filter((k) => k !== key) },
    state.entries.filter((_, i) => i !== index),
    index <= state.index ? state.index - 1 : state.index,
    "manual",
  );
}
export function clearShuffleQueue(state) {
  return { ...createShuffleQueue(state.enabled), nextKey: state.nextKey };
}

// An explicit drag becomes the new manual baseline, even with shuffle enabled.
// Moving the playing occurrence changes its queue position, never playback.
export function moveShuffleQueue(state, from, to) {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= state.entries.length ||
    to >= state.entries.length ||
    from === to
  )
    return state;
  const currentKey = state.entries[state.index]?.key;
  const entries = [...state.entries];
  const [entry] = entries.splice(from, 1);
  entries.splice(to, 0, entry);
  return finish(
    {
      ...state,
      originalOrder: entries.map((e) => e.key),
      pendingShuffle: false,
    },
    entries,
    currentKey === undefined
      ? -1
      : entries.findIndex((e) => e.key === currentKey),
    "manual",
  );
}
