// Status and pagination updates should not restart artwork or move the music
// someone is reading. Only currently mounted cards are candidates for reuse.
const signatures = new WeakMap();
function key(card) {
  const scope = card.closest("[data-wallet-snapshot]") ? "snapshot" : "wallet";
  return scope + ":" + (card.querySelector("h3 a")?.getAttribute("href") || "");
}
function signature(card) {
  return JSON.stringify([
    card.querySelector("h3")?.textContent,
    card.querySelector(".card-meta a")?.textContent,
    card.querySelector(".card-meta a")?.getAttribute("href"),
    card.querySelector("img")?.getAttribute("src"),
    card.querySelector(".cover-badge")?.textContent,
  ]);
}
function nodeKey(node) {
  if (node.nodeType !== 1) return "text";
  if (node.matches(".record-card")) return "card:" + key(node);
  for (const attribute of [
    "data-wallet-snapshot",
    "data-wallet-matches",
    "data-wallet-network",
    "id",
  ])
    if (node.hasAttribute(attribute))
      return attribute + ":" + node.getAttribute(attribute);
  return node.tagName + ":" + node.className;
}
function reconcile(parent, incoming) {
  const old = new Map();
  for (const child of parent.childNodes) {
    const id = nodeKey(child);
    if (!old.has(id)) old.set(id, []);
    old.get(id).push(child);
  }
  const retained = new Set();
  for (const [index, next] of [...incoming.childNodes].entries()) {
    const previous = old.get(nodeKey(next))?.shift();
    let selected = next;
    if (next.nodeType === 1 && next.matches(".record-card")) {
      const nextSignature = signature(next);
      if (previous && signatures.get(previous) === nextSignature)
        selected = previous;
      else signatures.set(next, nextSignature);
    } else if (
      previous?.nodeType === 1 &&
      (previous.querySelector(".record-card") ||
        next.querySelector?.(".record-card"))
    ) {
      // Keep grids/sections connected; moving them through a detached fragment
      // can trigger another native image load even without another request.
      reconcile(previous, next);
      selected = previous;
    }
    if (previous && selected !== previous && previous.parentNode === parent)
      previous.replaceWith(selected);
    const cursor = parent.childNodes[index] || null;
    if (selected !== cursor) parent.insertBefore(selected, cursor);
    retained.add(selected);
  }
  for (const child of [...parent.childNodes])
    if (child.parentNode === parent && !retained.has(child)) child.remove();
}
export function updateCollectionResults(target, html, view = window) {
  let anchor;
  for (const card of target.querySelectorAll(".record-card")) {
    if (!signatures.has(card)) signatures.set(card, signature(card));
    const box = card.getBoundingClientRect();
    if (!anchor && box.bottom > 100 && box.top < view.innerHeight)
      anchor = { card, top: box.top };
  }
  const previousScroll = view.scrollY;
  const template = target.ownerDocument.createElement("template");
  template.innerHTML = html;
  reconcile(target, template.content);
  const offset = anchor?.card.isConnected
    ? anchor.card.getBoundingClientRect().top - anchor.top
    : 0;
  // Native scroll anchoring may already have compensated during layout. Add
  // only the remaining visual displacement to its current scroll position.
  view.scrollTo({
    top: anchor?.card.isConnected ? view.scrollY + offset : previousScroll,
    behavior: "instant",
  });
}
