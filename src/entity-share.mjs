export function entityShareURL(kind, id, baseURL = globalThis.location?.href) {
  if (
    !["record", "artist", "playlist"].includes(kind) ||
    typeof id !== "string" ||
    !id ||
    id.length > 200
  )
    throw Error("This item cannot be shared.");
  const url = new URL(baseURL);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("A valid app address is required to share.");
  url.pathname = `/share/${kind}/${encodeURIComponent(id)}`;
  url.search = "";
  url.hash = "";
  return url.href;
}

export async function shareEntity(
  kind,
  id,
  title,
  {
    baseURL = globalThis.location?.href,
    navigator: nav = globalThis.navigator,
  } = {},
) {
  const url = entityShareURL(kind, id, baseURL);
  if (typeof nav?.share === "function") {
    try {
      await nav.share({ title, url });
      return { status: "shared", url };
    } catch (error) {
      if (error?.name === "AbortError") return { status: "cancelled", url };
    }
  }
  if (typeof nav?.clipboard?.writeText === "function") {
    try {
      await nav.clipboard.writeText(url);
      return { status: "copied", url };
    } catch {}
  }
  return { status: "manual", url };
}
