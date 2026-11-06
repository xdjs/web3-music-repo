export function mountNowPlaying({ dialog, getState, onAction, icon }) {
  const find = (name) => dialog.querySelector(`[data-now="${name}"]`);
  let returnTo, pointerReturn;
  dialog.dataset.inputMethod = "pointer";
  document.addEventListener(
    "pointerdown",
    () => {
      dialog.dataset.inputMethod = "pointer";
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      dialog.dataset.inputMethod = "keyboard";
      pointerReturn?.removeAttribute("data-now-pointer-focus");
      pointerReturn = null;
    },
    true,
  );
  const update = () => {
    const s = getState();
    if (!s.record) return;
    find("title").textContent = s.record.title;
    find("artist").textContent = s.record.artist;
    if (find("art").getAttribute("src") !== s.image) find("art").src = s.image;
    find("toggle").innerHTML = icon(s.action);
    find("toggle").setAttribute(
      "aria-label",
      s.action === "pause" ? "Pause" : "Play",
    );
    find("shuffle").setAttribute("aria-pressed", String(s.shuffle));
    find("like").innerHTML = icon("liked");
    find("like").classList.toggle("active", s.liked);
    find("like").setAttribute(
      "aria-label",
      s.liked ? "Unlike recording" : "Like recording",
    );
    find("like").setAttribute("aria-pressed", String(s.liked));
    find("elapsed").textContent = s.elapsed;
    find("duration").textContent = s.duration;
    find("seek").value = s.seek;
    find("mute").innerHTML = icon(s.muted ? "muted" : "volume");
    find("mute").setAttribute(
      "aria-label",
      s.muted ? "Unmute audio" : "Mute audio",
    );
    find("volume").value = s.volume;
  };
  const open = () => {
    if (!getState().record || dialog.open) return;
    returnTo = {
      x: scrollX,
      y: scrollY,
      hash: location.hash,
      focus: document.activeElement,
    };
    update();
    document.body.classList.add("now-playing-open");
    dialog.showModal();
  };
  const close = () => dialog.close();
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [
      ...dialog.querySelectorAll(
        "button:not([disabled]),input:not([disabled]),a[href]",
      ),
    ].filter((node) => node.tabIndex >= 0 && node.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("now-playing-open");
    if (returnTo?.hash === location.hash) {
      if (returnTo.focus?.isConnected) {
        if (dialog.dataset.inputMethod === "pointer") {
          pointerReturn?.removeAttribute("data-now-pointer-focus");
          pointerReturn = returnTo.focus;
          pointerReturn.setAttribute("data-now-pointer-focus", "");
        }
        returnTo.focus.focus({ preventScroll: true });
      }
      window.scrollTo({
        left: returnTo.x,
        top: returnTo.y,
        behavior: "instant",
      });
    }
  });
  dialog.addEventListener("click", (event) => {
    const action = event.target.closest("[data-now-action]")?.dataset.nowAction;
    if (!action) return;
    if (action === "back") close();
    else onAction(action);
    update();
  });
  for (const name of ["seek", "volume"])
    find(name).addEventListener("input", (event) =>
      onAction(name, Number(event.target.value)),
    );
  for (const name of ["shuffle", "previous", "next", "queue", "mute", "like"])
    find(name).innerHTML = icon(name === "like" ? "liked" : name);
  return { open, close, update };
}
