// A pending load is still pausable. A different occurrence in the queue is
// a distinct action even when it points to the same recording.
export function recordingControlState({
  id,
  currentId,
  requested,
  pending,
  paused,
  ended,
  error,
  queueIndex,
  controlQueueIndex,
}) {
  const current =
    !!id &&
    id === currentId &&
    (controlQueueIndex == null || controlQueueIndex === queueIndex);
  const active =
    current && requested && !ended && !error && (pending || !paused);
  return { current, action: active ? "pause" : "play" };
}

// Feedback follows native readiness, never the network's stalled event alone:
// a stalled download can still have plenty of playable media buffered.
export function playbackFeedback(state) {
  if (!state.requested || state.ended || state.error)
    return { busy: false, phase: "idle", message: "" };
  const phase = state.pending
    ? "loading"
    : state.paused
      ? "idle"
      : state.seeking
        ? "seeking"
        : state.readyState < 3
          ? state.currentTime > 0
            ? "buffering"
            : "loading"
          : "idle";
  return {
    busy: phase !== "idle",
    phase,
    message:
      { loading: "Loading…", buffering: "Buffering…", seeking: "Seeking…" }[
        phase
      ] || "",
  };
}

export function syncPlaybackButton(button, { action, feedback, label }, icon) {
  const busy = !!feedback?.busy;
  const accessible = `${label || (action === "pause" ? "Pause" : "Play")}${busy ? ` — ${feedback.message}` : ""}`;
  if (
    button.dataset.playbackAction === action &&
    button.getAttribute("aria-label") === accessible &&
    button.dataset.playbackBusy === String(busy)
  )
    return false;
  button.dataset.playbackAction = action;
  button.dataset.playbackBusy = String(busy);
  button.setAttribute("aria-label", accessible);
  button.innerHTML = `<span class="playback-glyph" aria-hidden="true">${icon(action)}</span>`;
  return true;
}

export const recordingControlSelector =
  "button[data-play],button[data-play-record]";

export function syncRecordingControls(root, state, { recordById, icon }) {
  for (const button of root.querySelectorAll(recordingControlSelector)) {
    const id = button.dataset.playRecord || button.dataset.play;
    const record = recordById(id);
    if (!record) continue;
    const { action } = recordingControlState({
      ...state,
      id,
      controlQueueIndex:
        button.dataset.queuePlay === undefined
          ? null
          : Number(button.dataset.queuePlay),
    });
    const label = `${action === "pause" ? "Pause" : "Play"} ${record.title}`;
    const feedback = playbackFeedback({
      ...state,
      requested: state.requested && action === "pause",
    });
    if (!syncPlaybackButton(button, { action, feedback, label }, icon))
      continue;
    if (button.classList.contains("primary")) {
      const text = button.ownerDocument.createElement("span");
      text.textContent =
        action === "pause"
          ? "Pause"
          : button.dataset.playPersonal
            ? "Play playlist"
            : button.dataset.playSnapshot &&
                button.dataset.snapshotIndex === undefined
              ? "Play recovered tracks"
              : "Play";
      button.append(text);
    }
  }
}
