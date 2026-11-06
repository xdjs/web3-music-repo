// Warm only the real player, so a matching click can retain its native buffer.
// Native preload is a browser hint, not a hard byte cap. Never claim otherwise.
export function createMediaPreloader(
  media,
  {
    isBusy = () => false,
    document: doc = globalThis.document,
    navigator: nav = globalThis.navigator,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    now = Date.now,
    delayMs = 650,
    deadlineMs = 2000,
  } = {},
) {
  let candidate = null,
    delay = null,
    deadline = null,
    disposed = false;
  const starts = [];
  const eligible = () =>
    !disposed &&
    !isBusy() &&
    media.paused &&
    !doc?.hidden &&
    nav?.onLine !== false &&
    !nav?.connection?.saveData &&
    !["slow-2g", "2g", "3g"].includes(nav?.connection?.effectiveType);
  const valid = (c) => {
    try {
      const u = new URL(c.url);
      return (
        c.id &&
        c.kind === "audio" &&
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.port
      );
    } catch {
      return false;
    }
  };
  const sameSource = () => candidate && media.src === candidate.url;
  function clearTimers() {
    clearTimer(delay);
    clearTimer(deadline);
    delay = deadline = null;
  }
  function cancel() {
    clearTimers();
    // Never clear a source already adopted by playback or replaced elsewhere.
    if (candidate?.started && sameSource() && !isBusy() && media.paused) {
      media.removeAttribute("src");
      media.preload = "none";
      media.load();
    }
    candidate = null;
  }
  function loaded() {
    if (!sameSource() || !candidate.started) return;
    if (!eligible()) {
      cancel();
      return;
    }
    clearTimer(deadline);
    deadline = null;
    candidate.ready = true;
    // Keep the source/buffer. Removing src would discard the warmed metadata.
    // The browser may already have requested bytes beyond metadata.
    media.preload = "none";
  }
  function schedule(value) {
    if (!eligible() || !valid(value)) return false;
    if (candidate?.id === value.id && candidate.url === value.url) return true;
    // Keep one candidate per idle period; scrolling cannot start a fetch storm.
    if (candidate) return false;
    while (starts.length && starts[0] <= now() - 60000) starts.shift();
    if (starts.length >= 2) return false;
    candidate = { ...value, started: false, ready: false };
    delay = setTimer(() => {
      delay = null;
      if (!eligible()) {
        cancel();
        return;
      }
      starts.push(now());
      candidate.started = true;
      media.preload = "metadata";
      media.src = candidate.url;
      media.load();
      deadline = setTimer(() => {
        // An incomplete idle request loses its buffer when canceled. Actual play
        // remains free to load the original source normally after this timeout.
        if (candidate && !candidate.ready) cancel();
      }, deadlineMs);
    }, delayMs);
    return true;
  }
  function take(id, url) {
    const reused =
      !!candidate?.started &&
      candidate.id === id &&
      candidate.url === url &&
      sameSource() &&
      !media.error;
    if (reused) {
      clearTimers();
      candidate = null;
      media.preload = "auto";
    } else cancel();
    return reused;
  }
  function onPolicyChange() {
    if (!eligible()) cancel();
  }
  function onPlay() {
    clearTimers();
    candidate = null;
  }
  media.addEventListener("loadedmetadata", loaded);
  media.addEventListener("error", cancel);
  media.addEventListener("play", onPlay);
  doc?.addEventListener("visibilitychange", onPolicyChange);
  nav?.connection?.addEventListener("change", onPolicyChange);
  globalThis.addEventListener?.("offline", onPolicyChange);
  return {
    schedule,
    take,
    cancel,
    state: () =>
      candidate
        ? {
            id: candidate.id,
            started: candidate.started,
            ready: candidate.ready,
          }
        : null,
    dispose() {
      cancel();
      disposed = true;
      media.removeEventListener("loadedmetadata", loaded);
      media.removeEventListener("error", cancel);
      media.removeEventListener("play", onPlay);
      doc?.removeEventListener("visibilitychange", onPolicyChange);
      nav?.connection?.removeEventListener("change", onPolicyChange);
      globalThis.removeEventListener?.("offline", onPolicyChange);
    },
  };
}
