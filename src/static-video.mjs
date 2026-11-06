import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
export function videoByteRange(value, size) {
  if (
    typeof value !== "string" ||
    value.length > 100 ||
    !Number.isSafeInteger(size) ||
    size <= 0
  )
    return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    return Number.isSafeInteger(suffix) && suffix > 0
      ? { start: Math.max(0, size - suffix), end: size - 1 }
      : null;
  }
  const start = Number(match[1]),
    end = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    return null;
  return { start, end: Math.min(end, size - 1) };
}
export async function serveStaticVideo(req, res, file) {
  let info;
  try {
    info = await stat(file);
    if (!info.isFile()) throw Error();
  } catch {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const modified = info.mtime.toUTCString();
  const rangeHeader =
    req.headers.range &&
    (!req.headers["if-range"] || req.headers["if-range"] === modified)
      ? req.headers.range
      : null;
  const range = rangeHeader ? videoByteRange(rangeHeader, info.size) : null;
  const headers = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Last-Modified": modified,
    "Cache-Control": "no-cache",
  };
  if (rangeHeader && !range) {
    res.writeHead(416, {
      ...headers,
      "Content-Range": `bytes */${info.size}`,
      "Content-Length": "0",
    });
    res.end();
    return;
  }
  const length = range ? range.end - range.start + 1 : info.size;
  res.writeHead(range ? 206 : 200, {
    ...headers,
    "Content-Length": length,
    ...(range
      ? { "Content-Range": `bytes ${range.start}-${range.end}/${info.size}` }
      : {}),
  });
  if (req.method === "HEAD" || !length) {
    res.end();
    return;
  }
  const stream = createReadStream(file, range || {});
  await new Promise((resolve) => {
    const finish = () => {
      stream.destroy();
      resolve();
    };
    res.once("finish", finish);
    res.once("close", finish);
    stream.once("error", () => {
      res.destroy();
      resolve();
    });
    stream.pipe(res);
  });
}
