export function selectQueueTrack(
  state,
  id,
  context = [],
  explicit = null,
  index = null,
) {
  if (explicit) {
    return {
      ids: [...explicit],
      index: index ?? explicit.indexOf(id),
      mode: explicit === state.ids ? state.mode : "manual",
    };
  }
  if (!state.ids.length || state.mode !== "manual") {
    const ids = [...new Set(context.includes(id) ? context : [id, ...context])];
    return { ids, index: ids.indexOf(id), mode: "auto" };
  }
  const ids = [...state.ids];
  const existing = ids.indexOf(id);
  if (existing >= 0) return { ids, index: existing, mode: "manual" };
  const next = Math.max(0, state.index + 1);
  ids.splice(next, 0, id);
  return { ids, index: next, mode: "manual" };
}

export function removeQueueTrack(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.ids.length)
    return state;
  return {
    ids: state.ids.filter((_, i) => i !== index),
    index: index <= state.index ? state.index - 1 : state.index,
    mode: "manual",
  };
}
