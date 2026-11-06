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
    if (
      button.dataset.playbackAction === action &&
      button.getAttribute("aria-label") === label
    )
      continue;
    button.dataset.playbackAction = action;
    button.setAttribute("aria-label", label);
    button.innerHTML = icon(action);
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
