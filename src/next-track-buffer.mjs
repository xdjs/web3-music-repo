import { alternateMediaURLs } from "./media-recovery.js";

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
  deadlineMs = 60000,
  targetSeconds = 30,
  videoTargetSeconds = 8,
  baseURL = globalThis.location?.href,
} = {}) {
  let candidate = null,
    disposed = false;
  const attempted = new Map(),
    starts = [];
  const policy = () =>
    !disposed &&
    nav?.onLine !== false &&
    !nav?.connection?.saveData &&
    !["slow-2g", "2g", "3g"].includes(nav?.connection?.effectiveType);
  const normalizeURL = (value) => {
    try {
      const relative =
        typeof value === "string" &&
        value.startsWith("/") &&
        !value.startsWith("//");
      const u = relative ? new URL(value, baseURL) : new URL(value);
      const local = baseURL && u.origin === new URL(baseURL).origin;
      return !u.username &&
        !u.password &&
        ((u.protocol === "https:" && !u.port) ||
          (local && ["https:", "http:"].includes(u.protocol)))
        ? u.href
        : null;
    } catch {
      return null;
    }
  };
  const valid = (value) =>
    !!value?.id &&
    ["audio", "video"].includes(value.kind) &&
    normalizeURL(value.url);
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
    const c = candidate;
    if (!c) return;
    clearTimer(c.delay);
    c.delay = null;
    if (c.deadline !== null) {
      c.remainingMs = Math.max(0, c.remainingMs - (now() - c.activeAt));
      clearTimer(c.deadline);
      c.deadline = null;
    }
    // Changing the hint preserves native ranges. Never reset src/load on pause,
    // waiting, or the pause event immediately before natural ended adoption.
    if (c.media) c.media.preload = "none";
    c.suspended = true;
  }
  function resume(c) {
    if (!c.media || c.ready || c.retained || !policy() || !canWarm()) return;
    c.suspended = false;
    c.media.preload = "auto";
    if (c.deadline !== null) return;
    c.activeAt = now();
    c.deadline = setTimer(() => {
      c.deadline = null;
      c.remainingMs = 0;
      if (candidate !== c || c.ready) return;
      if (bufferedFromStart(c.media) > 0) {
        c.retained = true;
        suspend();
      } else cancel();
    }, c.remainingMs);
  }
  function schedule(value) {
    if (!valid(value)) {
      cancel();
      return false;
    }
    value = { ...value, url: normalizeURL(value.url) };
    const key = keyFor(value);
    if (candidate?.key === key) {
      if (!policy() || !canWarm()) suspend();
      else if (candidate.media) resume(candidate);
      else if (candidate.delay === null) startLater(candidate);
      return true;
    }
    cancel();
    const prior = attempted.get(key);
    if (
      !policy() ||
      !canWarm() ||
      (prior && (prior.count >= 3 || now() - prior.at < 5000))
    )
      return false;
    while (starts.length && starts[0] <= now() - 60000) starts.shift();
    if (starts.length >= 4) return false;
    const c = (candidate = {
      ...value,
      key,
      sourceURL: [value.url, ...alternateMediaURLs(value.url)][
        Math.min(prior?.count || 0, alternateMediaURLs(value.url).length)
      ],
      ready: false,
      started: false,
      media: null,
      delay: null,
      deadline: null,
      remainingMs: deadlineMs,
      activeAt: 0,
      suspended: false,
      retained: false,
    });
    startLater(c);
    return true;
  }
  function startLater(c) {
    c.delay = setTimer(() => {
      c.delay = null;
      if (candidate !== c || !policy() || !canWarm()) {
        if (candidate === c) suspend();
        return;
      }
      const media = (c.media = createMedia());
      c.started = true;
      starts.push(now());
      attempted.set(c.key, {
        count: (attempted.get(c.key)?.count || 0) + 1,
        at: now(),
      });
      if (attempted.size > 100) attempted.delete(attempted.keys().next().value);
      media.preload = "auto";
      media.playsInline = true;
      media.autoplay = false;
      c.progress = () => {
        if (candidate !== c) return;
        if (!policy()) {
          suspend();
          return;
        }
        if (!canWarm()) {
          suspend();
          return;
        }
        const seconds = c.kind === "video" ? videoTargetSeconds : targetSeconds;
        const target =
          Number.isFinite(media.duration) && media.duration > 0
            ? Math.min(seconds, media.duration)
            : seconds;
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
      media.src = c.sourceURL;
      media.load();
      resume(c);
    }, delayMs);
  }
  function take(id, url) {
    url = normalizeURL(url);
    const c = candidate;
    if (
      !c?.started ||
      c.id !== id ||
      c.url !== url ||
      c.media.src !== c.sourceURL ||
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
    if (!policy() || !canWarm()) suspend();
    else if (candidate?.media) resume(candidate);
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
            sourceURL: candidate.sourceURL,
            started: candidate.started,
            ready: candidate.ready,
            suspended: candidate.suspended,
            retained: candidate.retained,
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
