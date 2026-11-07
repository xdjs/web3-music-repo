export function clipStart(value, duration, length = 15) {
  return (
    Math.round(
      Math.max(
        0,
        Math.min(
          Math.floor(Math.max(0, duration - length) * 10) / 10,
          Number(value) || 0,
        ),
      ) * 10,
    ) / 10
  );
}
export function timelineStart(clientX, rect, duration, grabOffset = 7.5) {
  if (!(rect.width > 0) || !Number.isFinite(duration)) return 0;
  return clipStart(
    ((clientX - rect.left) / rect.width) * duration - grabOffset,
    duration,
  );
}
export function timeLabel(seconds) {
  const tenth = Math.round(Math.max(0, Number(seconds) || 0) * 10);
  const minutes = Math.floor(tenth / 600);
  const whole = Math.floor((tenth % 600) / 10);
  return `${minutes}:${String(whole).padStart(2, "0")}${tenth % 10 ? "." + (tenth % 10) : ""}`;
}
export function keyboardStart(key, start, duration, shift = false) {
  if (key === "Home") return 0;
  if (key === "End") return clipStart(duration, duration);
  const delta = {
    ArrowLeft: -1,
    ArrowDown: -1,
    ArrowRight: 1,
    ArrowUp: 1,
    PageDown: -5,
    PageUp: 5,
  }[key];
  return delta === undefined
    ? null
    : clipStart(start + delta * (shift ? 5 : 1), duration);
}
