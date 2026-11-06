// Same IPFS content address, a different public HTTP gateway. No replacement upload.
export function alternateMediaURL(url) {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "ipfs.filebase.io" ||
      !/^\/ipfs\/[A-Za-z0-9]+(?:\/|$)/.test(parsed.pathname)
    )
      return null;
    parsed.hostname = "gateway.pinata.cloud";
    return parsed.href;
  } catch {
    return null;
  }
}

export function createMediaRecovery(
  media,
  { originalURL, shouldPlay, onSwitch, onExhausted },
) {
  let activeURL = originalURL,
    switched = false,
    ended = false;
  const fallback = alternateMediaURL(originalURL);
  function recover(failedURL = activeURL) {
    if (ended || failedURL !== activeURL) return;
    if (!switched && fallback) {
      switched = true;
      activeURL = fallback;
      const resumeAt = Number.isFinite(media.currentTime)
        ? media.currentTime
        : 0;
      media.src = fallback;
      if (resumeAt > 0)
        media.addEventListener(
          "loadedmetadata",
          () => {
            if (!ended) media.currentTime = resumeAt;
          },
          { once: true },
        );
      onSwitch();
      media.load();
      if (shouldPlay())
        media.play().catch((error) => {
          if (error.name !== "AbortError" && error.name !== "NotAllowedError")
            recover(fallback);
        });
    } else {
      ended = true;
      onExhausted();
    }
  }
  const onError = () => recover(media.src);
  media.addEventListener("error", onError);
  return {
    recover,
    dispose: () => {
      ended = true;
      media.removeEventListener("error", onError);
    },
  };
}
