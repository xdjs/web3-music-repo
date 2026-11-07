import {
  clipStart,
  timelineStart,
  timeLabel,
  keyboardStart,
} from "./story-timeline.mjs";
import {
  boundedStoryFetch,
  loadStoryMedia,
  seekStoryMedia,
  storyStart,
  storySource,
  storyMimeType,
  drawStoryFrame,
  renderStoryClip,
  STORY_DURATION,
} from "./story-clip.mjs";

export function mountStoryExport({
  getRecord,
  artworkURL,
  title = (r) => r.title,
  onBeginPlayback = () => {},
}) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/src/story-export.css";
  document.head.append(stylesheet);
  const dialog = document.createElement("dialog");
  dialog.id = "story-export-dialog";
  dialog.setAttribute("aria-labelledby", "story-export-title");
  document.body.append(dialog);
  let activeId = null,
    session = 0,
    controller = null,
    previewMedia = null,
    sourceBlob = null,
    frame = null,
    exportURL = null,
    exportFile = null,
    sourceURL = null,
    record = null,
    provenance = null,
    previewTimer = null,
    auditionVersion = 0,
    dragSelection = null,
    previewPaintFrame = null,
    previewResizeObserver = null,
    previewThemeObserver = null,
    rendering = false;
  const $ = (selector) => dialog.querySelector(selector);
  function status(message, error = false) {
    const field = $("[data-story-status]");
    if (field) {
      field.textContent = message;
      field.classList.toggle("notice", error);
    }
  }
  function stopPreview() {
    auditionVersion++;
    const button = $("[data-story-preview]");
    if (button) {
      button.textContent = "Play excerpt";
      button.setAttribute("aria-pressed", "false");
    }
    clearInterval(previewTimer);
    previewMedia?.pause();
    $("[data-story-result]")?.pause();
  }
  function release() {
    cancelAnimationFrame(previewPaintFrame);
    previewPaintFrame = null;
    previewResizeObserver?.disconnect();
    previewThemeObserver?.disconnect();
    previewResizeObserver = null;
    previewThemeObserver = null;
    rendering = false;
    controller?.abort();
    stopPreview();
    for (const media of [previewMedia, $("video[data-story-result]")]) {
      if (media) {
        media.pause();
        media.removeAttribute("src");
        media.load();
      }
    }
    if (sourceURL) URL.revokeObjectURL(sourceURL);
    if (exportURL) URL.revokeObjectURL(exportURL);
    previewMedia = null;
    sourceBlob = null;
    sourceURL = null;
    exportURL = null;
    exportFile = null;
    frame?.artwork?.close();
    frame?.logo?.close();
    frame = null;
  }
  function close() {
    session++;
    dragSelection = null;
    release();
    if (dialog.open) dialog.close();
  }
  async function bitmap(url, signal) {
    const blob = await boundedStoryFetch(url, {
      signal,
      limit: 6 * 1024 * 1024,
      timeoutMs: 18000,
    });
    return createImageBitmap(blob);
  }
  async function open(id) {
    close();
    activeId = id;
    const generation = ++session;
    controller = new AbortController();
    const signal = controller.signal;
    dialog.innerHTML = `<div class="dialog-title"><h2 id="story-export-title">Create Story clip</h2><button class="icon" data-story-close aria-label="Close Story export">×</button></div><p class="link-note">A 15-second music clip with the recording’s artwork. Save the MP4 or share it from your device.</p><div class="story-export-layout"><div class="story-export-visual"><canvas data-story-canvas aria-label="Story artwork preview"></canvas><video data-story-result controls playsinline hidden aria-label="Exported Story preview"></video></div><div class="story-export-controls"><div class="story-selection-heading"><strong>Choose your 15 seconds</strong><span data-story-selection-label>0:00–0:15</span></div><p class="link-note" id="story-timeline-help">Drag the pink selection to find your moment.</p><div class="story-timeline" data-story-timeline><div class="story-selection" data-story-selection role="slider" tabindex="0" aria-label="Excerpt start" aria-describedby="story-timeline-help" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-disabled="true"><span aria-hidden="true">Ⅰ</span><span aria-hidden="true">Ⅰ</span></div></div><div class="story-timeline-labels" aria-hidden="true"><span>0:00</span><span data-story-total>Loading…</span></div><div class="story-audition"><label for="story-audition-seek">Preview position <output data-story-elapsed>0:00 / 0:15</output></label><input id="story-audition-seek" data-story-seek type="range" min="0" max="15" step="0.1" value="0" disabled aria-label="Position within selected excerpt"></div><div class="actions"><button class="outline-button" data-story-preview disabled aria-pressed="false">Play excerpt</button><button class="primary" data-story-render disabled>Create MP4</button><button class="outline-button" data-story-cancel hidden>Cancel export</button><button class="outline-button" data-story-retry hidden>Retry source</button></div><p class="link-note" data-story-range>Loading recording…</p><details class="story-exact"><summary>Set an exact start time</summary><label class="artist-search-label">Start at (seconds)<input data-story-start type="number" min="0" step="0.1" value="0" disabled></label></details><p class="link-note" data-story-status role="status">Preparing source and artwork…</p><p class="link-note" data-story-source></p><div class="actions" data-story-downloads hidden><a class="primary" data-story-download download>Download MP4</a><button class="outline-button" data-story-share>Share video</button><a class="text-button" data-story-manifest download>Source notes</a></div><p class="link-note">Keep this tab visible while exporting. Instagram upload is manual; the share sheet depends on your device. Browser exports support sources up to 32 MB.</p></div></div>`;
    dialog.showModal();
    // A single repaint after layout/theme changes refreshes WebKit's resized canvas layer.
    // The recorder owns the canvas while exporting; this is never a continuous paint loop.
    const repaintPreview = () => {
      if (previewPaintFrame !== null) return;
      previewPaintFrame = requestAnimationFrame(() => {
        previewPaintFrame = null;
        if (generation !== session || !frame || rendering || !dialog.open)
          return;
        const canvas = $("[data-story-canvas]");
        if (canvas && !canvas.hidden) drawStoryFrame(canvas, frame);
      });
    };
    previewResizeObserver = new ResizeObserver(repaintPreview);
    previewResizeObserver.observe($(".story-export-visual"));
    previewThemeObserver = new MutationObserver(repaintPreview);
    previewThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    if (!storyMimeType()) {
      status(
        "This browser cannot create H.264/AAC MP4 clips. Try a current Safari or Chrome browser.",
        true,
      );
      return;
    }
    try {
      const loadedRecord = await getRecord(id);
      if (generation !== session) return;
      record = loadedRecord;
      provenance = storySource(record);
      $("[data-story-source]").textContent =
        provenance.label +
        ". This export does not change the archived recording.";
      frame = { title: title(record), artist: record.artist };
      const images = await Promise.allSettled([
        bitmap(artworkURL(record), signal),
        bitmap("/musicnerd-lenses.png", signal),
      ]);
      if (generation !== session) {
        images.forEach((r) => {
          if (r.status === "fulfilled") r.value.close();
        });
        return;
      }
      frame.artwork = images[0].status === "fulfilled" ? images[0].value : null;
      frame.logo = images[1].status === "fulfilled" ? images[1].value : null;
      drawStoryFrame($("canvas"), frame);
      if (!frame.artwork)
        throw new Error(
          "The artwork could not be loaded for export. Try again later; you can still share the song link.",
        );
      const loadedBlob = await boundedStoryFetch(provenance.url, { signal });
      if (generation !== session) return;
      sourceBlob = loadedBlob;
      const loaded = await loadStoryMedia(sourceBlob, signal);
      if (generation !== session) {
        loaded.media.pause();
        loaded.media.removeAttribute("src");
        loaded.media.load();
        URL.revokeObjectURL(loaded.url);
        return;
      }
      previewMedia = loaded.media;
      sourceURL = loaded.url;
      $("[data-story-start]").max = String(
        Math.max(0, previewMedia.duration - STORY_DURATION),
      );
      for (const control of dialog.querySelectorAll(
        "[data-story-start],[data-story-seek],[data-story-preview],[data-story-render]",
      ))
        control.disabled = false;
      $("[data-story-selection]").setAttribute("aria-disabled", "false");
      range();
      status("Choose your excerpt, then create the MP4.");
    } catch (error) {
      if (generation === session && error.name !== "AbortError") {
        status(error.message, true);
        $("[data-story-retry]").hidden = false;
      }
    }
  }
  function range() {
    if (!previewMedia) return;
    const from = storyStart(
      $("[data-story-start]").value,
      previewMedia.duration,
    );
    $("[data-story-start]").value = String(from);
    const end = from + STORY_DURATION;
    $("[data-story-selection-label]").textContent =
      `${timeLabel(from)}–${timeLabel(end)}`;
    $("[data-story-range]").textContent =
      `15-second excerpt · ${timeLabel(from)} to ${timeLabel(end)}`;
    $("[data-story-range]").hidden = true;
    $("[data-story-total]").textContent = timeLabel(previewMedia.duration);
    const selection = $("[data-story-selection]");
    selection.style.left = `${(100 * from) / previewMedia.duration}%`;
    selection.style.width = `${(100 * STORY_DURATION) / previewMedia.duration}%`;
    selection.setAttribute(
      "aria-valuemax",
      String(Math.max(0, previewMedia.duration - STORY_DURATION)),
    );
    selection.setAttribute("aria-valuenow", String(from));
    selection.setAttribute(
      "aria-valuetext",
      `${timeLabel(from)} to ${timeLabel(end)}`,
    );
    return from;
  }
  function progress(position = 0) {
    const value = Math.max(0, Math.min(STORY_DURATION, position));
    $("[data-story-seek]").value = String(value);
    $("[data-story-elapsed]").textContent = `${timeLabel(value)} / 0:15`;
  }
  function selectExcerpt(value) {
    if (!previewMedia || $("[data-story-start]").disabled) return;
    stopPreview();
    $("[data-story-start]").value = String(
      clipStart(value, previewMedia.duration),
    );
    range();
    progress();
    $("[data-story-downloads]").hidden = true;
    $("[data-story-result]").hidden = true;
    $("canvas").hidden = false;
    exportFile = null;
    status("Play your selection, then create the MP4.");
  }
  async function audition(offset = 0) {
    const generation = session;
    const media = previewMedia;
    stopPreview();
    const version = auditionVersion;
    if (!media) return;
    try {
      onBeginPlayback();
      const from = range();
      await seekStoryMedia(
        media,
        from + Math.min(14.9, offset),
        controller.signal,
      );
      if (generation !== session || version !== auditionVersion) return;
      await media.play();
      if (generation !== session) {
        media.pause();
        return;
      }
      if (version !== auditionVersion) return;
      $("[data-story-preview]").textContent = "Pause excerpt";
      $("[data-story-preview]").setAttribute("aria-pressed", "true");
      status("Playing your selection…");
      previewTimer = setInterval(() => {
        if (generation !== session || version !== auditionVersion) return;
        progress(media.currentTime - from);
        if (media.currentTime >= from + STORY_DURATION || media.ended) {
          stopPreview();
          progress(STORY_DURATION);
          status("Preview finished. Replay or choose another moment.");
        }
      }, 40);
    } catch (error) {
      if (
        generation === session &&
        version === auditionVersion &&
        error.name !== "AbortError"
      )
        status(error.message, true);
    }
  }
  dialog.addEventListener("pointerdown", (event) => {
    const track = event.target.closest("[data-story-timeline]");
    if (
      !track ||
      !previewMedia ||
      $("[data-story-start]").disabled ||
      event.button > 0
    )
      return;
    const rect = track.getBoundingClientRect();
    const from = range();
    const inside = event.target.closest("[data-story-selection]");
    dragSelection = {
      id: event.pointerId,
      offset: inside
        ? ((event.clientX - rect.left) / rect.width) * previewMedia.duration -
          from
        : 7.5,
      resume: !previewMedia.paused,
    };
    track.setPointerCapture(event.pointerId);
    $("[data-story-selection]").focus({ preventScroll: true });
    selectExcerpt(
      timelineStart(
        event.clientX,
        rect,
        previewMedia.duration,
        dragSelection.offset,
      ),
    );
    event.preventDefault();
  });
  dialog.addEventListener("pointermove", (event) => {
    if (!dragSelection || event.pointerId !== dragSelection.id) return;
    selectExcerpt(
      timelineStart(
        event.clientX,
        $("[data-story-timeline]").getBoundingClientRect(),
        previewMedia.duration,
        dragSelection.offset,
      ),
    );
  });
  function endDrag(event) {
    if (!dragSelection || event.pointerId !== dragSelection.id) return;
    const resume = dragSelection.resume && event.type !== "pointercancel";
    dragSelection = null;
    if (resume) audition();
  }
  dialog.addEventListener("pointerup", endDrag);
  dialog.addEventListener("pointercancel", endDrag);
  dialog.addEventListener("keydown", (event) => {
    if (
      !event.target.matches("[data-story-selection]") ||
      !previewMedia ||
      $("[data-story-start]").disabled
    )
      return;
    const next = keyboardStart(
      event.key,
      range(),
      previewMedia.duration,
      event.shiftKey,
    );
    if (next === null) return;
    event.preventDefault();
    selectExcerpt(next);
  });
  dialog.addEventListener("input", (event) => {
    if (!event.target.matches("[data-story-seek]")) return;
    stopPreview();
    progress(Number(event.target.value));
  });
  dialog.addEventListener(
    "play",
    (event) => {
      if (event.target.matches("[data-story-result]")) {
        auditionVersion++;
        clearInterval(previewTimer);
        previewMedia?.pause();
        $("[data-story-preview]").textContent = "Play excerpt";
        $("[data-story-preview]").setAttribute("aria-pressed", "false");
        onBeginPlayback();
      }
    },
    true,
  );
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("change", (event) => {
    if (event.target.matches("[data-story-start]"))
      selectExcerpt(event.target.value);
    if (event.target.matches("[data-story-seek]"))
      audition(Number(event.target.value));
  });
  dialog.addEventListener("click", async (event) => {
    if (event.target.closest("[data-story-close]")) {
      close();
      return;
    }
    if (event.target.closest("[data-story-retry]")) {
      open(activeId);
      return;
    }
    if (event.target.closest("[data-story-cancel]")) {
      controller?.abort();
      return;
    }
    if (event.target.closest("[data-story-preview]")) {
      if (previewMedia && !previewMedia.paused) {
        stopPreview();
        status("Preview paused.");
      } else {
        const offset = Number($("[data-story-seek]").value);
        await audition(offset >= STORY_DURATION ? 0 : offset);
      }
      return;
    }
    if (event.target.closest("[data-story-share]")) {
      if (!exportFile) return;
      try {
        if (!navigator.canShare?.({ files: [exportFile] })) {
          status(
            "Video sharing is unavailable here. Download the MP4, then upload it to Instagram.",
          );
          return;
        }
        await navigator.share({ files: [exportFile], title: frame.title });
        status("The video was handed to your device’s share sheet.");
      } catch (error) {
        status(
          error.name === "AbortError"
            ? "Sharing cancelled. Your MP4 is still available."
            : "Sharing is unavailable here. Download the MP4 instead.",
          error.name !== "AbortError",
        );
      }
      return;
    }
    if (event.target.closest("[data-story-render]")) {
      const generation = session;
      stopPreview();
      onBeginPlayback();
      let exportMedia = null,
        localURL = null;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const from = range();
        for (const control of dialog.querySelectorAll(
          "[data-story-start],[data-story-seek],[data-story-preview],[data-story-render]",
        ))
          control.disabled = true;
        rendering = true;
        $("[data-story-selection]").setAttribute("aria-disabled", "true");
        $("[data-story-cancel]").hidden = false;
        status("Creating MP4… 0%");
        const loaded = await loadStoryMedia(sourceBlob, signal);
        exportMedia = loaded.media;
        localURL = loaded.url;
        const result = await renderStoryClip({
          media: exportMedia,
          canvas: $("canvas"),
          frame,
          start: from,
          signal,
          onProgress: (p) => {
            if (session === generation)
              status(`Creating MP4… ${Math.round(p * 100)}%`);
          },
        });
        if (generation !== session) return;
        if (exportURL) URL.revokeObjectURL(exportURL);
        exportURL = URL.createObjectURL(result.blob);
        const filename =
          (title(record)
            .replace(/[^a-z0-9_-]+/gi, "-")
            .slice(0, 70) || "music") + "-story.mp4";
        exportFile = new File([result.blob], filename, { type: "video/mp4" });
        const video = $("[data-story-result]");
        video.src = exportURL;
        video.hidden = false;
        $("canvas").hidden = true;
        const download = $("[data-story-download]");
        download.href = exportURL;
        download.download = filename;
        const manifest = {
          recordId: record.id,
          title: title(record),
          artist: record.artist,
          start: result.start,
          duration: result.duration,
          source: provenance,
          format: "H.264/AAC MP4",
          dimensions: [1080, 1920],
          exportedAt: new Date().toISOString(),
          recordURL:
            location.origin + "/share/record/" + encodeURIComponent(record.id),
        };
        $("[data-story-manifest]").href =
          "data:application/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(manifest, null, 2));
        $("[data-story-manifest]").download = filename.replace(
          ".mp4",
          "-source.json",
        );
        $("[data-story-downloads]").hidden = false;
        status("MP4 ready. Preview it before sharing.");
      } catch (error) {
        if (generation === session)
          status(
            error.name === "AbortError"
              ? "Export cancelled. You can try again."
              : error.message,
            error.name !== "AbortError",
          );
      } finally {
        if (exportMedia) {
          exportMedia.pause();
          exportMedia.removeAttribute("src");
          exportMedia.load();
        }
        if (localURL) URL.revokeObjectURL(localURL);
        if (generation === session) {
          rendering = false;
          for (const control of dialog.querySelectorAll(
            "[data-story-start],[data-story-seek],[data-story-preview],[data-story-render]",
          ))
            control.disabled = false;
          $("[data-story-selection]").setAttribute("aria-disabled", "false");
          $("[data-story-cancel]").hidden = true;
          controller = new AbortController();
        }
      }
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-story-export]");
    if (button) open(button.dataset.storyExport);
  });
  window.addEventListener("hashchange", close);
  return { open, close };
}
