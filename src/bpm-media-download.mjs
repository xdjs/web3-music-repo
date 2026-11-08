import { open, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { storageURL } from "./nft-reader.mjs";
import { alternateMediaURLs } from "./media-recovery.js";

export class BpmTransferError extends Error {
  constructor(reason, message, attempts = []) {
    super(message);
    this.name = "BpmTransferError";
    this.reason = reason;
    this.attempts = attempts;
    this.retryable = true;
    this.deferred =
      reason === "size-limit" ||
      (["total-timeout", "idle-timeout"].includes(reason) &&
        attempts.some((a) => a.bytes > 0));
  }
}
export function bpmMediaCandidates(source) {
  const canonical = storageURL(source);
  return [...new Set([canonical, ...alternateMediaURLs(canonical)])];
}
// HTTPS redirects may stay at the exact generated address, or at an allowlisted
// Arweave content subdomain. Never follow an arbitrary URL supplied by a gateway.
export function allowedBpmRedirect(from, target, candidates) {
  let next;
  try {
    next = new URL(target, from);
  } catch {
    return false;
  }
  if (next.protocol !== "https:" || next.username || next.password || next.port)
    return false;
  if (candidates.includes(next.href)) return true;
  const base = new URL(from);
  return (
    /^(?:[a-z2-7]{52}\.)?(?:arweave\.net|turbo-gateway\.com)$/.test(
      base.hostname,
    ) &&
    /^[a-z2-7]{52}\.(?:arweave\.net|turbo-gateway\.com)$/.test(next.hostname) &&
    /^\/[A-Za-z0-9_-]{43}(?:\/|$)/.test(base.pathname) &&
    next.pathname === base.pathname &&
    next.search === base.search
  );
}
function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
export async function downloadBpmMedia(source, path, options = {}) {
  const {
    fetcher = fetch,
    connectionTimeoutMs = 20000,
    idleTimeoutMs = 20000,
    totalTimeoutMs = 180000,
    maxBytes = 256 * 1024 * 1024,
    onRateLimit = () => {},
  } = options;
  for (const [name, n] of Object.entries({
    connectionTimeoutMs,
    idleTimeoutMs,
    totalTimeoutMs,
    maxBytes,
  }))
    if (!Number.isFinite(n) || n <= 0) throw Error(`Invalid ${name}`);
  const candidates = bpmMediaCandidates(source),
    attempts = [],
    started = Date.now();
  let received = 0,
    lastError;
  try {
    for (const candidate of candidates) {
      const remaining = totalTimeoutMs - (Date.now() - started);
      if (remaining <= 0)
        throw new BpmTransferError(
          "total-timeout",
          "Source transfer budget exhausted",
          attempts,
        );
      const controller = new AbortController(),
        attempt = {
          url: candidate,
          host: new URL(candidate).hostname,
          startedAt: new Date().toISOString(),
          bytes: 0,
        };
      attempts.push(attempt);
      let connectionTimer, idleTimer, totalTimer, handle, reader;
      const abort = (reason, message) =>
        controller.abort(new BpmTransferError(reason, message));
      totalTimer = setTimeout(
        () => abort("total-timeout", "Source transfer budget exhausted"),
        remaining,
      );
      connectionTimer = setTimeout(
        () => abort("connect-timeout", "Gateway response headers timed out"),
        connectionTimeoutMs,
      );
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(
          () =>
            abort(
              "idle-timeout",
              "Media transfer made no progress before deadline",
            ),
          idleTimeoutMs,
        );
      };
      const attemptStart = Date.now();
      try {
        let response,
          url = candidate;
        for (let redirects = 0; redirects < 4; redirects++) {
          response = await abortable(
            fetcher(url, {
              redirect: "manual",
              headers: { "accept-encoding": "identity" },
              signal: controller.signal,
            }),
            controller.signal,
          );
          attempt.status = response.status;
          attempt.responseURL = url;
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const target = response.headers.get("location");
            await response.body?.cancel();
            if (!target || !allowedBpmRedirect(url, target, candidates))
              throw new BpmTransferError(
                "redirect-rejected",
                "Gateway redirect changed content identity or host",
              );
            url = new URL(target, url).href;
            continue;
          }
          break;
        }
        if ([301, 302, 303, 307, 308].includes(response.status))
          throw new BpmTransferError(
            "redirect-rejected",
            "Gateway redirect limit",
          );
        clearTimeout(connectionTimer);
        attempt.headersMs = Date.now() - attemptStart;
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status === 429) onRateLimit({ url, status: 429 });
          throw new BpmTransferError(
            "http-error",
            `Media HTTP ${response.status}`,
          );
        }
        if (response.status === 206 || response.headers.has("content-range")) {
          const range = /^bytes 0-(\d+)\/(\d+)$/.exec(
            response.headers.get("content-range") || "",
          );
          if (!range || Number(range[1]) + 1 !== Number(range[2])) {
            await response.body?.cancel();
            throw new BpmTransferError(
              "partial-response",
              "Gateway returned an incomplete range without a range request",
            );
          }
        }
        const contentLength = response.headers.get("content-length");
        const expected =
          contentLength && /^\d+$/.test(contentLength)
            ? Number(contentLength)
            : null;
        attempt.contentLength = expected;
        attempt.contentType = response.headers.get("content-type");
        if (expected !== null && expected > maxBytes - received) {
          await response.body?.cancel();
          throw new BpmTransferError(
            "size-limit",
            "Source exceeds remaining bounded download budget",
          );
        }
        if (!response.body)
          throw new BpmTransferError(
            "empty-media",
            "Media response has no body",
          );
        const hash = createHash("sha256");
        handle = await open(path, "w");
        reader = response.body.getReader();
        resetIdle();
        while (true) {
          const chunk = await abortable(reader.read(), controller.signal);
          if (chunk.done) break;
          if (!chunk.value?.length) continue;
          attempt.bytes += chunk.value.length;
          received += chunk.value.length;
          attempt.lastProgressMs = Date.now() - attemptStart;
          if (received > maxBytes)
            throw new BpmTransferError(
              "size-limit",
              "Source exceeds bounded download byte budget",
            );
          hash.update(chunk.value);
          await handle.writeFile(chunk.value);
          resetIdle();
        }
        if (!attempt.bytes)
          throw new BpmTransferError("empty-media", "Media response is empty");
        if (
          expected !== null &&
          (!response.headers.get("content-encoding") ||
            response.headers.get("content-encoding") === "identity") &&
          expected !== attempt.bytes
        )
          throw new BpmTransferError(
            "length-mismatch",
            "Media body length does not match response",
          );
        attempt.elapsedMs = Date.now() - attemptStart;
        attempt.result = "complete";
        return {
          source,
          url,
          sha256: hash.digest("hex"),
          bytes: attempt.bytes,
          receivedBytes: received,
          attempts,
          transferBudget: {
            connectionTimeoutMs,
            idleTimeoutMs,
            totalTimeoutMs,
            maxBytes,
          },
          elapsedMs: Date.now() - started,
        };
      } catch (error) {
        const cause = controller.signal.aborted
          ? controller.signal.reason
          : error;
        lastError =
          cause instanceof BpmTransferError
            ? cause
            : new BpmTransferError(
                "network-error",
                cause?.message || "Media transfer failed",
              );
        attempt.elapsedMs = Date.now() - attemptStart;
        attempt.reason = lastError.reason;
        attempt.error = lastError.message;
        attempt.result = "failed";
        if (["size-limit", "total-timeout"].includes(lastError.reason))
          throw new BpmTransferError(
            lastError.reason,
            lastError.message,
            attempts,
          );
      } finally {
        clearTimeout(connectionTimer);
        clearTimeout(idleTimer);
        clearTimeout(totalTimer);
        controller.abort();
        try {
          await reader?.cancel();
        } catch {}
        try {
          await handle?.close();
        } catch {}
      }
    }
    throw new BpmTransferError(
      lastError?.reason || "network-error",
      lastError?.message || "No available original media gateway",
      attempts,
    );
  } catch (error) {
    await rm(path, { force: true });
    if (error instanceof BpmTransferError) throw error;
    throw new BpmTransferError("network-error", error.message, attempts);
  }
}
