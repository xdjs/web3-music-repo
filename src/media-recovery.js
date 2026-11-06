// Same IPFS content address or Arweave transaction and path through fixed gateways.
// These hosts are deliberately finite; user-supplied gateway hosts never join them.
const gateways = [
  "ipfs.filebase.io",
  "gateway.pinata.cloud",
  "magic.decentralized-content.com",
];
export function alternateMediaURLs(url) {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      /(?:^|\/)\.\.(?:\/|$)/.test(decodeURIComponent(url.split("?")[0])) ||
      /%2f|%5c|\\/i.test(parsed.pathname)
    )
      return [];
    // A transaction ID identifies the same Arweave data across these fixed
    // gateways. Do not rewrite ArNS names, API endpoints, or arbitrary hosts.
    const arweaveHost =
      /^(?:www\.|[a-z2-7]{52}\.)?arweave\.net$/.test(parsed.hostname) ||
      /^(?:[a-z2-7]{52}\.)?turbo-gateway\.com$/.test(parsed.hostname);
    if (
      arweaveHost &&
      /^\/[A-Za-z0-9_-]{43}(?:\/[^\s]*)?$/.test(parsed.pathname)
    ) {
      return ["turbo-gateway.com", "arweave.net"]
        .filter((host) => host !== parsed.hostname)
        .map((host) => {
          const alternate = new URL(parsed);
          alternate.hostname = host;
          return alternate.href;
        });
    }
    if (
      !gateways.includes(parsed.hostname) ||
      !/^\/ipfs\/[A-Za-z0-9]+(?:\/|$)/.test(parsed.pathname)
    )
      return [];
    return gateways
      .filter((host) => host !== parsed.hostname)
      .map((host) => {
        const alternate = new URL(parsed);
        alternate.hostname = host;
        return alternate.href;
      });
  } catch {
    return [];
  }
}
export function alternateMediaURL(url) {
  return alternateMediaURLs(url)[0] || null;
}

export function createMediaRecovery(
  media,
  { originalURL, shouldPlay, onSwitch, onExhausted, onSlow = () => {} },
) {
  let activeURL = originalURL,
    ended = false;
  const fallbacks = alternateMediaURLs(originalURL);
  const seekListeners = new Set();
  function recover(failedURL = activeURL, { softTimeout = false } = {}) {
    if (ended || failedURL !== activeURL) return;
    if (softTimeout && !shouldPlay()) return;
    const fallback = fallbacks.shift();
    if (fallback) {
      activeURL = fallback;
      const resumeAt = Number.isFinite(media.currentTime)
        ? media.currentTime
        : 0;
      media.src = fallback;
      if (resumeAt > 0) {
        const seek = () => {
          seekListeners.delete(seek);
          if (!ended && activeURL === fallback) media.currentTime = resumeAt;
        };
        seekListeners.add(seek);
        media.addEventListener("loadedmetadata", seek, { once: true });
      }
      onSwitch();
      media.load();
      if (shouldPlay())
        media.play().catch((error) => {
          if (error.name !== "AbortError" && error.name !== "NotAllowedError")
            recover(fallback);
        });
    } else {
      // A loading deadline is not a network/decoder error. With no alternate
      // source, keep the current request alive so delayed audio can still start.
      if (softTimeout && !media.error) {
        onSlow();
        return "waiting";
      }
      ended = true;
      onExhausted();
    }
  }
  const onError = () => recover(media.src);
  media.addEventListener("error", onError);
  return {
    recover,
    recoverSlow: (failedURL = activeURL) =>
      recover(failedURL, { softTimeout: true }),
    dispose: () => {
      ended = true;
      media.removeEventListener("error", onError);
      for (const seek of seekListeners)
        media.removeEventListener("loadedmetadata", seek);
      seekListeners.clear();
    },
  };
}
