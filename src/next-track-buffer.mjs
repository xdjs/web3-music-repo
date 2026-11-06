// One real standby media element. Reusing this element preserves its native buffer.
// preload=none after the target is a hint: native buffering has no hard byte cap.
export function bufferedFromStart(media) {
  try {
    for (let i = 0; i < media.buffered.length; i++)
      if (media.buffered.start(i) <= 0.1) return media.buffered.end(i);
  } catch {}
  return 0;
}
export function hasPlaybackHeadroom(media, seconds = 10) {
  if (media.paused || media.readyState < 3) return false;
  const position = media.currentTime;
  if (!Number.isFinite(position)) return false;
  const remaining = Number.isFinite(media.duration)
    ? Math.max(0, media.duration - position)
    : Infinity;
  try {
    for (let i = 0; i < media.buffered.length; i++) {
      if (
        media.buffered.start(i) <= position + 0.05 &&
        media.buffered.end(i) >= position + Math.min(seconds, remaining) - 0.05
      )
        return true;
    }
  } catch {}
  return false;
}
export function createNextTrackBuffer({
  createMedia = () => document.createElement("video"),
  canWarm = () => true,
  document: doc = globalThis.document,
  navigator: nav = globalThis.navigator,
  events = globalThis,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
  delayMs = 700,
  deadlineMs = 20000,
  targetSeconds = 10,
} = {}) {
  let candidate = null,
    disposed = false;
  const attempted = new Set(),
    starts = [];
  const policy = () =>
    !disposed &&
    !doc?.hidden &&
    nav?.onLine !== false &&
    !nav?.connection?.saveData &&
    !["slow-2g", "2g", "3g"].includes(nav?.connection?.effectiveType);
  const valid = (value) => {
    try {
      const u = new URL(value?.url);
      return (
        !!value.id &&
        value.kind === "audio" &&
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.port
      );
    } catch {
      return false;
    }
  };
  const keyFor = (value) =>
    `${value.contextId || ""}\n${value.id}\n${value.url}`;
  function detach(c) {
    clearTimer(c.delay);
    clearTimer(c.deadline);
    c.delay = c.deadline = null;
    if (c.media) {
      c.media.removeEventListener("progress", c.progress);
      c.media.removeEventListener("loadeddata", c.progress);
      c.media.removeEventListener("canplay", c.progress);
      c.media.removeEventListener("error", c.error);
    }
  }
  function cancel() {
    const c = candidate;
    candidate = null;
    if (!c) return;
    detach(c);
    if (c.media) {
      c.media.pause();
      c.media.removeAttribute("src");
      c.media.preload = "none";
      c.media.load();
    }
  }
  function suspend() {
    if (candidate?.ready) {
      candidate.media.preload = "none";
      return;
    }
    cancel();
  }
  function schedule(value) {
    if (!valid(value)) {
      cancel();
      return false;
    }
    const key = keyFor(value);
    if (candidate?.key === key) {
      if (!policy()) cancel();
      else if (!canWarm()) suspend();
      return !!candidate;
    }
    cancel();
    if (!policy() || !canWarm() || attempted.has(key)) return false;
    while (starts.length && starts[0] <= now() - 60000) starts.shift();
    if (starts.length >= 4) return false;
    const c = (candidate = {
      ...value,
      key,
      ready: false,
      started: false,
      media: null,
      delay: null,
      deadline: null,
    });
    c.delay = setTimer(() => {
      c.delay = null;
      if (candidate !== c || !policy() || !canWarm()) {
        if (candidate === c) cancel();
        return;
      }
      const media = (c.media = createMedia());
      c.started = true;
      starts.push(now());
      attempted.add(key);
      if (attempted.size > 100)
        attempted.delete(attempted.values().next().value);
      media.preload = "auto";
      media.playsInline = true;
      media.autoplay = false;
      c.progress = () => {
        if (candidate !== c) return;
        if (!policy()) {
          cancel();
          return;
        }
        if (!canWarm()) {
          suspend();
          return;
        }
        const target =
          Number.isFinite(media.duration) && media.duration > 0
            ? Math.min(targetSeconds, media.duration)
            : targetSeconds;
        if (bufferedFromStart(media) >= target - 0.1) {
          c.ready = true;
          clearTimer(c.deadline);
          c.deadline = null;
          media.preload = "none";
        }
      };
      c.error = () => {
        if (candidate === c) cancel();
      };
      media.addEventListener("progress", c.progress);
      media.addEventListener("loadeddata", c.progress);
      media.addEventListener("canplay", c.progress);
      media.addEventListener("error", c.error);
      media.src = c.url;
      media.load();
      c.deadline = setTimer(() => {
        if (candidate === c && !c.ready) cancel();
      }, deadlineMs);
    }, delayMs);
    return true;
  }
  function take(id, url) {
    const c = candidate;
    if (
      !c?.started ||
      c.id !== id ||
      c.url !== url ||
      c.media.src !== url ||
      c.media.error
    ) {
      cancel();
      return null;
    }
    candidate = null;
    detach(c);
    c.media.preload = "auto";
    return c.media;
  }
  const onPolicy = () => {
    if (!policy()) cancel();
  };
  doc?.addEventListener("visibilitychange", onPolicy);
  nav?.connection?.addEventListener("change", onPolicy);
  events?.addEventListener?.("offline", onPolicy);
  return {
    schedule,
    take,
    cancel,
    suspend,
    state: () =>
      candidate
        ? {
            id: candidate.id,
            url: candidate.url,
            started: candidate.started,
            ready: candidate.ready,
            bufferedSeconds: candidate.media
              ? bufferedFromStart(candidate.media)
              : 0,
          }
        : null,
    dispose() {
      cancel();
      disposed = true;
      doc?.removeEventListener("visibilitychange", onPolicy);
      nav?.connection?.removeEventListener("change", onPolicy);
      events?.removeEventListener?.("offline", onPolicy);
    },
  };
}
