export const STORY_DURATION = 15;
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
export const STORY_SOURCE_LIMIT = 32 * 1024 * 1024;
const MP4_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
];
export function storyMimeType(Recorder = globalThis.MediaRecorder) {
  return MP4_TYPES.find((type) => Recorder?.isTypeSupported?.(type)) || null;
}
export function storyStart(value, duration) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0)
    throw new Error("Choose a valid start time.");
  if (!Number.isFinite(duration) || duration < STORY_DURATION)
    throw new Error("This recording is too short for a 15-second clip.");
  return Math.min(number, duration - STORY_DURATION);
}
export function storySource(record) {
  const url = record.playback?.workingURL || record.recovery?.mediaURL;
  if (!url)
    throw new Error("No playable source is available for this recording.");
  const sourceType =
    record.playback?.sourceType ||
    record.recovery?.mediaSourceType ||
    "original-nft-media";
  const label = sourceType.includes("artist")
    ? "Artist-supplied playback master"
    : sourceType === "spinamp-preserved-audio"
      ? "Spinamp preserved playback copy"
      : sourceType === "archived-sound-cdn"
        ? "Recovered Sound playback copy"
        : record.recovery?.status === "indexed"
          ? "Media from the preserved platform index"
          : "NFT media source";
  return {
    url,
    sourceType,
    label,
    originalURI: record.recovery?.mediaURI || null,
  };
}
export async function boundedStoryFetch(
  url,
  {
    signal,
    limit = STORY_SOURCE_LIMIT,
    timeoutMs = 30000,
    fetchImpl = fetch,
  } = {},
) {
  const parsed = new URL(
    url,
    globalThis.location?.origin || "https://web3-music-archive.vercel.app",
  );
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error("This source cannot be exported.");
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error("The source took too long to load. Try again."),
      ),
    timeoutMs,
  );
  try {
    const response = await fetchImpl(parsed.href, {
      signal: controller.signal,
      mode: "cors",
      credentials: "omit",
    });
    if (!response.ok)
      throw new Error(`The source could not be loaded (${response.status}).`);
    const length = Number(response.headers.get("content-length"));
    if (length > limit) {
      await response.body?.cancel();
      throw new Error(
        "This source is too large for a browser Story export. Listening is still available.",
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new Error("This browser cannot safely load the export source.");
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > limit)
          throw new Error(
            "This source is too large for a browser Story export. Listening is still available.",
          );
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
    return new Blob(chunks, {
      type: response.headers.get("content-type") || "application/octet-stream",
    });
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (controller.signal.aborted)
      throw new Error("The source took too long to load. Try again.");
    if (error instanceof TypeError)
      throw new Error(
        "This source blocks browser export or is unavailable. You can still listen or share its song link.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
function waitMedia(media, event, signal, action, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      media.removeEventListener(event, done);
      media.removeEventListener("error", fail);
      signal?.removeEventListener("abort", abort);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("This source cannot be decoded by this browser."));
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The source took too long to prepare."));
    }, timeoutMs);
    media.addEventListener(event, done, { once: true });
    media.addEventListener("error", fail, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    action();
  });
}
export async function loadStoryMedia(blob, signal) {
  const media = document.createElement("video");
  media.preload = "auto";
  media.playsInline = true;
  const url = URL.createObjectURL(blob);
  try {
    await waitMedia(media, "loadedmetadata", signal, () => {
      media.src = url;
    });
    storyStart(0, media.duration);
    return { media, url };
  } catch (error) {
    media.removeAttribute("src");
    media.load();
    URL.revokeObjectURL(url);
    throw error;
  }
}
export async function seekStoryMedia(media, start, signal) {
  if (Math.abs(media.currentTime - start) < 0.02) return;
  await waitMedia(media, "seeked", signal, () => {
    media.currentTime = start;
  });
}
function lines(ctx, text, width, maxLines) {
  const words = String(text || "").split(/\s+/);
  const output = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > width && line) {
      output.push(line);
      line = word;
    } else line = next;
  }
  if (line) output.push(line);
  if (output.length > maxLines) {
    output.length = maxLines;
    output[maxLines - 1] += "…";
  }
  return output.map((value) => {
    while (ctx.measureText(value).width > width && value.length > 1)
      value = value.slice(0, -2) + "…";
    return value;
  });
}
export function drawStoryFrame(
  canvas,
  { title, artist, artwork, logo, progress = 0 },
) {
  if (canvas.width !== STORY_WIDTH) canvas.width = STORY_WIDTH;
  if (canvas.height !== STORY_HEIGHT) canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 1080, 1920);
  if (logo) ctx.drawImage(logo, 82, 220, 100, 100);
  ctx.fillStyle = "#fff";
  ctx.font = "700 42px system-ui, sans-serif";
  ctx.fillText("MUSIC NERD", 210, 267);
  ctx.fillStyle = "#b2b2b2";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText("web3 music archive", 210, 307);
  ctx.fillStyle = "#fb57c0";
  ctx.fillRect(72, 382, 936, 936);
  if (artwork) {
    const scale = Math.min(904 / artwork.width, 904 / artwork.height);
    const w = artwork.width * scale,
      h = artwork.height * scale;
    ctx.drawImage(artwork, 540 - w / 2, 850 - h / 2, w, h);
  } else {
    ctx.fillStyle = "#000";
    ctx.font = "700 72px system-ui, sans-serif";
    ctx.fillText("Music, recovered.", 140, 875);
  }
  ctx.fillStyle = "#fff";
  ctx.font = "700 60px system-ui, sans-serif";
  const titleLines = lines(ctx, title, 920, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, 80, 1420 + i * 70));
  ctx.fillStyle = "#fb57c0";
  ctx.font = "40px system-ui, sans-serif";
  lines(ctx, artist, 920, 2).forEach((line, i) =>
    ctx.fillText(line, 80, 1580 + i * 48),
  );
  ctx.fillStyle = "#aaa";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText("web3-music-archive.vercel.app", 80, 1725);
  ctx.fillStyle = "#333";
  ctx.fillRect(80, 1760, 920, 4);
  ctx.fillStyle = "#fb57c0";
  ctx.fillRect(80, 1760, 920 * Math.max(0, Math.min(1, progress)), 4);
}
export async function renderStoryClip({
  media,
  canvas,
  frame,
  start,
  signal,
  onProgress = () => {},
}) {
  const mimeType = storyMimeType();
  if (!mimeType)
    throw new Error(
      "This browser cannot create H.264/AAC MP4 clips. Try a current Safari or Chrome browser.",
    );
  if (document.hidden)
    throw new Error("Keep this tab visible while creating the clip.");
  const from = storyStart(start, media.duration);
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  const audio = new Context();
  const destination = audio.createMediaStreamDestination();
  let source,
    stream,
    recorder,
    animation,
    interval,
    timer,
    removeListeners = () => {};
  const chunks = [];
  let bytes = 0,
    heardAudio = false;
  try {
    await audio.resume();
    // Each export gets a fresh native decoder. No whole-file PCM allocation and
    // no connection to speakers or the app player; only this source is recorded.
    source = audio.createMediaElementSource(media);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(destination);
    await seekStoryMedia(media, from, signal);
    drawStoryFrame(canvas, frame);
    stream = new MediaStream([
      ...canvas.captureStream(24).getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 3500000,
      audioBitsPerSecond: 192000,
    });
    const result = await new Promise((resolve, reject) => {
      let finished = false;
      const fail = (error) => {
        if (finished) return;
        finished = true;
        reject(error);
      };
      const abort = () => fail(new DOMException("Cancelled", "AbortError"));
      const visibility = () => {
        if (document.hidden)
          fail(
            new Error(
              "Export stopped because the tab was hidden. Keep it visible and try again.",
            ),
          );
      };
      const samples = new Float32Array(analyser.fftSize);
      recorder.ondataavailable = (e) => {
        if (e.data.size) {
          bytes += e.data.size;
          if (bytes > 16 * 1024 * 1024)
            fail(new Error("The generated clip exceeded the export limit."));
          else chunks.push(e.data);
        }
      };
      recorder.onerror = () =>
        fail(
          new Error(
            "The browser could not encode this MP4. Try again or use a different browser.",
          ),
        );
      recorder.onstop = () => {
        if (finished) return;
        finished = true;
        if (!heardAudio)
          return reject(
            new Error("No audio was captured. Try another excerpt or source."),
          );
        resolve(new Blob(chunks, { type: "video/mp4" }));
      };
      removeListeners = () => {
        signal?.removeEventListener("abort", abort);
        document.removeEventListener("visibilitychange", visibility);
      };
      signal?.addEventListener("abort", abort, { once: true });
      document.addEventListener("visibilitychange", visibility);
      timer = setTimeout(
        () =>
          fail(
            new Error("Export timed out. Keep this tab visible and try again."),
          ),
        25000,
      );
      interval = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        if (samples.some((v) => Math.abs(v) > 0.0001)) heardAudio = true;
        const elapsed = media.currentTime - from;
        onProgress(Math.min(1, elapsed / STORY_DURATION));
        if (elapsed >= STORY_DURATION) {
          media.pause();
          if (recorder.state === "recording") recorder.stop();
        }
      }, 30);
      const draw = () => {
        drawStoryFrame(canvas, {
          ...frame,
          progress: (media.currentTime - from) / STORY_DURATION,
        });
        animation = requestAnimationFrame(draw);
      };
      draw();
      recorder.start(500);
      media
        .play()
        .catch((error) =>
          fail(new Error("Audio could not start: " + error.message)),
        );
      if (signal?.aborted) abort();
    });
    if (result.size < 1000)
      throw new Error("The browser returned an empty clip.");
    return { blob: result, start: from, duration: STORY_DURATION, mimeType };
  } finally {
    removeListeners();
    clearInterval(interval);
    clearTimeout(timer);
    cancelAnimationFrame(animation);
    media.pause();
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    source?.disconnect();
    await audio.close().catch(() => {});
  }
}
