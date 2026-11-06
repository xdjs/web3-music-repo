export function classifySoundSample(row) {
  if (row.totalMinted === "0") return "unminted";
  if (row.recovered) return "metadata-recovered";
  if (row.metadataAttempts?.some((x) => x.metadata))
    return "metadata-without-supported-media";
  if (row.metadataAttempts?.length) return "storage-unavailable";
  if (row.calls?.some((x) => x.name.startsWith("tokenURI:") && x.error))
    return "token-uri-unavailable";
  return "rpc-unavailable";
}
export function parseArchivedSoundRelease(html, { chainId, contract }) {
  if (typeof html !== "string" || html.length > 2000000)
    throw Error("Invalid capture");
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) throw Error("Missing release payload");
  const release = JSON.parse(match[1]).props?.pageProps?.releaseData?.data
    ?.mintedRelease;
  if (
    release?.chainId !== chainId ||
    release.contractAddress?.toLowerCase() !== contract.toLowerCase()
  )
    throw Error("Captured release does not match chain/contract");
  const audio = html.match(/<meta name="og:audio" content="([^"]+)"/);
  if (!audio) throw Error("No captured audio");
  const url = new URL(audio[1]);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "d2i9ybouka0ieh.cloudfront.net" ||
    url.username ||
    url.password ||
    url.port ||
    !/^\/audio-transcoded\/[0-9a-f-]{36}\/AUDIO_[0-9]+K\//i.test(url.pathname)
  )
    throw Error("Unexpected Sound audio reference");
  if (url.pathname.split("/")[2] !== release.track?.id)
    throw Error("Audio does not match captured track");
  return { release, mediaURL: url.href };
}
export function classifyLogResponse(response) {
  if (Array.isArray(response.result) && !response.error)
    return { status: "range-read", logCount: response.result.length };
  const message = response.error?.message || "Missing log array";
  return {
    status: "unavailable",
    reason: /personal token|archive requests/i.test(message)
      ? "archive-access-required"
      : /range|10000/i.test(message)
        ? "provider-range-restriction"
        : /limit|rate/i.test(message)
          ? "rate-limited"
          : "provider-error",
    message,
  };
}
