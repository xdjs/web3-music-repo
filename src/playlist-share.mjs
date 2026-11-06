export const PLAYLIST_SHARE_LIMITS = Object.freeze({
  tracks: 5000,
  name: 100,
  id: 200,
  jsonBytes: 500000,
  encodedChars: 24000,
});
export function playlistSnapshot(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > PLAYLIST_SHARE_LIMITS.name ||
    !Array.isArray(value.recordIds) ||
    value.recordIds.length > PLAYLIST_SHARE_LIMITS.tracks ||
    value.recordIds.some(
      (id) =>
        typeof id !== "string" || !id || id.length > PLAYLIST_SHARE_LIMITS.id,
    )
  )
    throw Error("This playlist is invalid or exceeds the sharing limits.");
  // Deliberately omit account IDs, local playlist IDs, timestamps and extra fields.
  return { v: 1, name: value.name.trim(), recordIds: [...value.recordIds] };
}
async function boundedBytes(stream, max) {
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel();
        throw Error(
          "This playlist is too large to share as a link. Export it instead.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
function base64url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export async function encodePlaylistShare(value) {
  const snapshot = playlistSnapshot(value);
  const body = new TextEncoder().encode(JSON.stringify(snapshot));
  if (body.byteLength > PLAYLIST_SHARE_LIMITS.jsonBytes)
    throw Error(
      "This playlist is too large to share as a link. Export it instead.",
    );
  if (typeof CompressionStream !== "function")
    throw Error(
      "Playlist links are not supported in this browser. Export a copy instead.",
    );
  const compressed = await boundedBytes(
    new Blob([body]).stream().pipeThrough(new CompressionStream("gzip")),
    (PLAYLIST_SHARE_LIMITS.encodedChars * 3) / 4,
  );
  const token = "v1." + base64url(compressed);
  if (token.length > PLAYLIST_SHARE_LIMITS.encodedChars)
    throw Error(
      "This playlist is too large to share as a link. Export it instead.",
    );
  return token;
}
export async function decodePlaylistShare(token) {
  if (
    typeof token !== "string" ||
    token.length > PLAYLIST_SHARE_LIMITS.encodedChars ||
    !/^v1\.[A-Za-z0-9_-]+$/.test(token)
  )
    throw Error("This playlist link is invalid or incomplete.");
  if (typeof DecompressionStream !== "function")
    throw Error("Playlist links are not supported in this browser.");
  try {
    const encoded = token.slice(3),
      binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const compressed = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    if (base64url(compressed) !== encoded) throw Error("Noncanonical link");
    const bytes = await boundedBytes(
      new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream("gzip")),
      PLAYLIST_SHARE_LIMITS.jsonBytes,
    );
    const data = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (data.v !== 1) throw Error("Unsupported playlist version");
    return playlistSnapshot(data);
  } catch {
    throw Error("This playlist link is invalid, incomplete or too large.");
  }
}
export async function createPlaylistShareURL(value, baseURL) {
  const url = new URL(baseURL);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("A valid app address is required to share.");
  url.search = "";
  url.hash = "";
  const token = await encodePlaylistShare(value);
  if (token.length > 7000)
    throw Error(
      "This playlist is too large to share as a link. Export it instead.",
    );
  url.pathname = "/share/mix/" + token;
  return url.href;
}
export async function shareOrCopyPlaylist(
  value,
  { baseURL, navigator: nav = globalThis.navigator } = {},
) {
  const url = await createPlaylistShareURL(value, baseURL);
  const title = playlistSnapshot(value).name;
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
