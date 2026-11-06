import { alternateMediaURLs } from "./media-recovery.js";

const installations = new WeakMap();

// Retry only the identical IPFS CID/path through our fixed gateway list.
// Original alt text, dimensions, and the caller's final-error fallback survive.
export function installImageRecovery(root = document) {
  if (installations.has(root)) return installations.get(root);
  const states = new WeakMap();
  function recover(image, event) {
    if (image?.tagName !== "IMG" || image.srcset || !image.src) return;
    // A responsive <picture> may choose a different resource than img.src.
    if (image.parentElement?.tagName === "PICTURE") return;
    const source = image.src;
    if (image.currentSrc && image.currentSrc !== source) return;
    let state = states.get(image);
    if (!state || !state.seen.has(source)) {
      const alternatives = alternateMediaURLs(source);
      if (!alternatives.length) return;
      state = { seen: new Set([source]), remaining: alternatives };
      states.set(image, state);
    }
    const next = state.remaining.shift();
    if (!next) return;
    state.seen.add(next);
    // Some avatars remove their image on error to reveal initials. Let that
    // existing behavior run only after all same-content alternatives fail.
    event?.stopImmediatePropagation();
    image.src = next;
  }
  const onError = (event) => recover(event.target, event);
  root.addEventListener("error", onError, true);
  for (const image of root.querySelectorAll?.("img") || []) {
    if (image.complete && image.naturalWidth === 0) recover(image);
  }
  const dispose = () => {
    root.removeEventListener("error", onError, true);
    installations.delete(root);
  };
  installations.set(root, dispose);
  return dispose;
}
