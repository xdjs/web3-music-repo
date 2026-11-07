// Only generated continuation is bounded. Explicit playlists and manual queue
// occurrences remain intact, including intentionally repeated recordings.
export function createAutoplaySession(enabled = true, discoveryOffset = 0) {
  return {
    enabled,
    context: [],
    contextIndex: 0,
    discoveryIndex: discoveryOffset,
    attempted: new Set(),
    removed: new Set(),
  };
}
export function startAutoplayContext(session, ids = []) {
  return { ...session, context: [...new Set(ids)], contextIndex: 0 };
}
export function noteQueueAttempt(session, id) {
  return { ...session, attempted: new Set([...session.attempted, id]) };
}
export function excludeQueueRecording(session, id) {
  return { ...session, removed: new Set([...session.removed, id]) };
}
export function removeAutoplayTail(queue) {
  const entries = queue.entries.filter(
    (entry, index) =>
      index <= queue.index || !entry.generated || entry.origin !== "autoplay",
  );
  const keys = new Set(entries.map((e) => e.key));
  return {
    ...queue,
    entries,
    ids: entries.map((e) => e.id),
    originalOrder: queue.originalOrder.filter((key) => keys.has(key)),
  };
}
export function replenishAutoplay(
  queue,
  session,
  discovery,
  { target = 20, playable = () => true, random = Math.random } = {},
) {
  if (!session.enabled || !queue.entries.length) return { queue, session };
  const capacity = Math.max(
    0,
    target - (queue.entries.length - queue.index - 1),
  );
  if (!capacity) return { queue, session };
  const excluded = new Set([
    ...session.attempted,
    ...session.removed,
    ...queue.ids,
  ]);
  let contextIndex = session.contextIndex,
    discoveryIndex = session.discoveryIndex;
  const additions = [];
  const choose = (id, origin) => {
    if (!id || excluded.has(id) || !playable(id)) return;
    excluded.add(id);
    additions.push({
      id,
      key: queue.nextKey + additions.length,
      origin,
      generated: true,
    });
  };
  while (additions.length < capacity && contextIndex < session.context.length)
    choose(session.context[contextIndex++], "context");
  let searched = 0;
  while (additions.length < capacity && searched < discovery.length) {
    choose(discovery[discoveryIndex % discovery.length], "autoplay");
    discoveryIndex++;
    searched++;
  }
  const additionKeys = additions.map((e) => e.key);
  if (queue.enabled) {
    for (let i = additions.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [additions[i], additions[j]] = [additions[j], additions[i]];
    }
  }
  // A shuffle may reorder a source cohort, but cannot jump past the remaining
  // browsing context into wider discovery.
  additions.sort(
    (a, b) => Number(a.origin === "autoplay") - Number(b.origin === "autoplay"),
  );
  const entries = [...queue.entries, ...additions];
  return {
    queue: additions.length
      ? {
          ...queue,
          entries,
          ids: entries.map((e) => e.id),
          nextKey: queue.nextKey + additions.length,
          originalOrder: [...queue.originalOrder, ...additionKeys],
        }
      : queue,
    session: { ...session, contextIndex, discoveryIndex },
  };
}

// Latency is not a failure. Only confirmed exhausted sources in automatic
// continuation may advance; a deliberately queued/playlist occurrence stops.
export function shouldSkipUnavailable({
  enabled,
  requested,
  generated,
  mode,
  hardFailure,
  failures,
}) {
  return (
    !!enabled &&
    !!requested &&
    !!hardFailure &&
    (generated || mode === "auto") &&
    failures <= 3
  );
}
