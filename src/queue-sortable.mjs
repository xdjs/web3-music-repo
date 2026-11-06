// Reorder only from the explicit handle. Scrolling elsewhere remains native.
export function mountQueueSortable(list, { onMove, announce = () => {} }) {
  const view = list.ownerDocument.defaultView;
  let drag = null,
    frame = null;
  const rows = () => [...list.querySelectorAll("[data-queue-key]")];
  const clearIndicators = () =>
    rows().forEach((row) =>
      row.classList.remove(
        "queue-drop-before",
        "queue-drop-after",
        "queue-dragging",
      ),
    );
  function indicate() {
    clearIndicators();
    if (!drag?.active) return;
    const remaining = rows().filter((row) => row.dataset.queueKey !== drag.key);
    drag.to = remaining.filter((row) => {
      const r = row.getBoundingClientRect();
      return drag.y > r.top + r.height / 2;
    }).length;
    rows()
      .find((row) => row.dataset.queueKey === drag.key)
      ?.classList.add("queue-dragging");
    if (remaining[drag.to])
      remaining[drag.to].classList.add("queue-drop-before");
    else remaining.at(-1)?.classList.add("queue-drop-after");
  }
  function autoScroll() {
    if (!drag?.active) return;
    const container = list.closest("dialog") || list;
    const bounds = container.getBoundingClientRect();
    const direction =
      drag.y < bounds.top + 28 ? -1 : drag.y > bounds.bottom - 28 ? 1 : 0;
    if (direction) {
      container.scrollTop += direction * 8;
      indicate();
    }
    frame = view.requestAnimationFrame(autoScroll);
  }
  function finish(commit) {
    const ended = drag;
    drag = null;
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    clearIndicators();
    if (!ended) return;
    try {
      if (ended.handle.hasPointerCapture(ended.pointerId))
        ended.handle.releasePointerCapture(ended.pointerId);
    } catch {}
    if (commit && ended.active) onMove(ended.key, ended.to, "pointer");
  }
  const down = (event) => {
    const handle = event.target.closest("[data-queue-drag]");
    if (
      !handle ||
      !list.contains(handle) ||
      event.button !== 0 ||
      event.isPrimary === false
    )
      return;
    finish(false);
    drag = {
      key: handle.closest("[data-queue-key]").dataset.queueKey,
      handle,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startY: event.clientY,
      active: false,
      to: 0,
    };
    handle.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.y = event.clientY;
    if (
      !drag.active &&
      Math.hypot(event.clientX - drag.x, event.clientY - drag.startY) < 7
    )
      return;
    if (!drag.active) {
      drag.active = true;
      frame = view.requestAnimationFrame(autoScroll);
    }
    event.preventDefault();
    indicate();
  };
  const up = (event) => {
    if (drag?.pointerId === event.pointerId) finish(true);
  };
  const cancel = (event) => {
    if (drag?.pointerId === event.pointerId) finish(false);
  };
  const key = (event) => {
    const handle = event.target.closest("[data-queue-drag]");
    if (!handle || !list.contains(handle)) return;
    if (event.key === "Escape" && drag) {
      event.preventDefault();
      finish(false);
      return;
    }
    if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const items = rows(),
      from = items.indexOf(handle.closest("[data-queue-key]")),
      to = from + (event.key === "ArrowUp" ? -1 : 1);
    if (to >= 0 && to < items.length)
      onMove(items[from].dataset.queueKey, to, "keyboard");
    else
      announce(
        event.key === "ArrowUp"
          ? "Already first in queue"
          : "Already last in queue",
      );
  };
  list.addEventListener("pointerdown", down);
  list.addEventListener("pointermove", move, { passive: false });
  list.addEventListener("pointerup", up);
  list.addEventListener("pointercancel", cancel);
  list.addEventListener("lostpointercapture", cancel);
  list.addEventListener("keydown", key);
  const dialog = list.closest("dialog");
  const close = () => finish(false);
  dialog?.addEventListener("close", close);
  return {
    cancel: close,
    dispose() {
      finish(false);
      list.removeEventListener("pointerdown", down);
      list.removeEventListener("pointermove", move);
      list.removeEventListener("pointerup", up);
      list.removeEventListener("pointercancel", cancel);
      list.removeEventListener("lostpointercapture", cancel);
      list.removeEventListener("keydown", key);
      dialog?.removeEventListener("close", close);
    },
  };
}
