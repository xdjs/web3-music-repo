// Native range input remains in control during a gesture. Commit only once on
// change, so decoder seeks do not compete with every intermediate thumb move.
export function bindSeekRange(input, { commit, preview = () => {} }) {
  let editing = false,
    draft = null;
  const normalized = (value) => Math.min(1000, Math.max(0, Number(value) || 0));
  const cancel = () => {
    editing = false;
    draft = null;
  };
  input.addEventListener("pointerdown", () => {
    editing = true;
  });
  input.addEventListener("keydown", (event) => {
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ].includes(event.key)
    )
      editing = true;
  });
  input.addEventListener("input", () => {
    editing = true;
    draft = normalized(input.value);
    preview(draft);
  });
  input.addEventListener("change", () => {
    const value = draft ?? normalized(input.value);
    cancel();
    commit(value);
  });
  input.addEventListener("pointercancel", cancel);
  input.addEventListener("blur", cancel);
  return {
    sync(value) {
      if (!editing) input.value = normalized(value);
      return editing ? draft : null;
    },
  };
}

export function mountNowPlaying({
  dialog,
  getState,
  onAction,
  icon,
  formatTime,
}) {
  const find = (name) => dialog.querySelector(`[data-now="${name}"]`);
  let returnTo, pointerReturn;
  const seek = bindSeekRange(find("seek"), {
    commit: (value) => onAction("seek", value),
    preview: (value) => {
      const duration = getState().durationSeconds;
      if (Number.isFinite(duration))
        find("elapsed").textContent = formatTime((duration * value) / 1000);
    },
  });
  const visual = dialog.querySelector(".now-playing-visual");
  const stage = dialog.querySelector(".now-playing-media");
  let inertBackground = [];
  const positionMedia = () => {
    if (!dialog.open) return;
    const box = stage.getBoundingClientRect();
    for (const [key, value] of Object.entries({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    }))
      document.documentElement.style.setProperty(
        "--now-media-" + key,
        value + "px",
      );
  };
  const mediaSize = new ResizeObserver(([entry]) => {
    if (entry.contentRect.height > 0)
      visual.style.setProperty(
        "--available-media-height",
        entry.contentRect.height + "px",
      );
    positionMedia();
  });
  mediaSize.observe(visual);
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
    dialog.classList.toggle("has-video", s.hasVideo);
    if (s.hasVideo) positionMedia();
    find("title").textContent = s.record.title;
    find("artist").textContent = s.record.artist;
    find("title").href = s.recordHref;
    find("artist").href = s.artistHref;
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
    const draft = seek.sync(s.seek);
    find("elapsed").textContent =
      draft === null
        ? s.elapsed
        : formatTime((s.durationSeconds * draft) / 1000);
    find("duration").textContent = s.duration;
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
    inertBackground = [
      ...document.querySelectorAll(".workspace,.sidebar,.player,.mobile-nav"),
    ].filter((node) => !node.inert);
    for (const node of inertBackground) node.inert = true;
    dialog.show();
    find("back").focus({ preventScroll: true });
    positionMedia();
  };
  const close = () => dialog.close();
  dialog.addEventListener("scroll", positionMedia);
  window.addEventListener("resize", positionMedia);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
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
    for (const node of inertBackground) node.inert = false;
    inertBackground = [];
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
    const link = event.target.closest("[data-now-link]");
    if (
      link &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      close();
      onAction("navigate", link.getAttribute("href"));
      return;
    }
    const action = event.target.closest("[data-now-action]")?.dataset.nowAction;
    if (!action) return;
    if (action === "back") close();
    else onAction(action);
    update();
  });
  for (const name of ["volume"])
    find(name).addEventListener("input", (event) =>
      onAction(name, Number(event.target.value)),
    );
  for (const name of ["shuffle", "previous", "next", "queue", "mute", "like"])
    find(name).innerHTML = icon(name === "like" ? "liked" : name);
  return { open, close, update };
}
