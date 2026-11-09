import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  downloadBpmMedia,
  bpmMediaCandidates,
  allowedBpmRedirect,
} from "../src/bpm-media-download.mjs";
const source =
  "https://gateway.pinata.cloud/ipfs/QmExactContent/music.mp4?ext=mp4";
const candidates = bpmMediaCandidates(source);
const temporary = async (fn) => {
  const dir = await mkdtemp(join(tmpdir(), "bpm-transfer-"));
  try {
    await fn(join(dir, "media"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
function response(chunks, delay = 0, headers = {}) {
  let cancelled = false;
  return new Response(
    new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          if (delay) await new Promise((r) => setTimeout(r, delay));
          if (cancelled) return;
          controller.enqueue(new Uint8Array(chunk));
        }
        if (!cancelled) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    }),
    { headers },
  );
}
test("same-CID fallback fetches actual alternate without recanonicalization and records original source", () =>
  temporary(async (path) => {
    const calls = [];
    const result = await downloadBpmMedia(source, path, {
      fetcher: async (url) => {
        calls.push(url);
        if (calls.length === 1) throw Error("fetch failed");
        return new Response("original-media", {
          headers: { "content-length": "14" },
        });
      },
    });
    assert.deepEqual(calls, candidates.slice(0, 2));
    assert.match(result.url, /gateway.pinata.cloud/);
    assert.equal(result.source, source);
    assert.equal(result.attempts[0].reason, "network-error");
    assert.equal(result.attempts[1].bytes, 14);
    assert.equal(await readFile(path, "utf8"), "original-media");
  }));
test("progressive transfer can exceed connection deadline without being treated as failed", () =>
  temporary(async (path) => {
    const result = await downloadBpmMedia(source, path, {
      connectionTimeoutMs: 10,
      idleTimeoutMs: 60,
      totalTimeoutMs: 300,
      fetcher: async () => response(Array(6).fill([1, 2, 3]), 12),
    });
    assert.equal(result.bytes, 18);
    assert.ok(result.elapsedMs >= 60);
    assert.equal(result.attempts.length, 1);
  }));
test("idle mid-body failure retains byte evidence and uses one bounded exact-content alternate", () =>
  temporary(async (path) => {
    let call = 0;
    const result = await downloadBpmMedia(source, path, {
      idleTimeoutMs: 15,
      totalTimeoutMs: 300,
      maxBytes: 100,
      fetcher: async () =>
        ++call === 1
          ? new Response(
              new ReadableStream({
                start(c) {
                  c.enqueue(new Uint8Array([1, 2]));
                },
                cancel() {},
              }),
            )
          : new Response("complete"),
    });
    assert.equal(result.attempts[0].reason, "idle-timeout");
    assert.equal(result.attempts[0].bytes, 2);
    assert.equal(result.bytes, 8);
    assert.equal(result.receivedBytes, 10);
  }));
test("bounded total expiry with progress is retryable deferred and does not redownload through all gateways", () =>
  temporary(async (path) => {
    let calls = 0;
    await assert.rejects(
      downloadBpmMedia(source, path, {
        connectionTimeoutMs: 10,
        idleTimeoutMs: 40,
        totalTimeoutMs: 45,
        fetcher: async () => {
          calls++;
          return response(Array(20).fill([1, 2]), 10);
        },
      }),
      (error) =>
        error.deferred &&
        error.retryable &&
        error.reason === "total-timeout" &&
        error.attempts[0].bytes > 0,
    );
    assert.equal(calls, 1);
    await assert.rejects(access(path));
  }));
test("declared and observed byte budgets prevent oversized download and mark deferral separately", () =>
  temporary(async (path) => {
    await assert.rejects(
      downloadBpmMedia(source, path, {
        maxBytes: 10,
        fetcher: async () =>
          new Response("too large", { headers: { "content-length": "100" } }),
      }),
      (e) =>
        e.deferred && e.reason === "size-limit" && e.attempts[0].bytes === 0,
    );
    await assert.rejects(
      downloadBpmMedia(source, path, {
        maxBytes: 10,
        fetcher: async () =>
          response([
            [1, 2, 3, 4, 5, 6],
            [1, 2, 3, 4, 5, 6],
          ]),
      }),
      (e) => e.deferred && e.attempts[0].bytes === 12,
    );
    await assert.rejects(access(path));
  }));
test("redirects cannot change content, transformed query, credentials or private host", () =>
  temporary(async (path) => {
    for (const bad of [
      "http://127.0.0.1/media",
      "https://evil.example/ipfs/QmExactContent/music.mp4?ext=mp4",
      "https://gateway.pinata.cloud/ipfs/QmDifferent/music.mp4?ext=mp4",
      "https://gateway.pinata.cloud/ipfs/QmExactContent/music.mp4?width=10",
      "https://user:secret@gateway.pinata.cloud/ipfs/QmExactContent/music.mp4?ext=mp4",
    ])
      assert.equal(allowedBpmRedirect(candidates[0], bad, candidates), false);
    const calls = [];
    await assert.rejects(
      downloadBpmMedia(source, path, {
        fetcher: async (url) => {
          calls.push(url);
          return new Response(null, {
            status: 302,
            headers: { location: "http://127.0.0.1/private" },
          });
        },
      }),
      (e) => e.reason === "redirect-rejected",
    );
    assert.deepEqual(calls, candidates);
  }));
test("Arweave redirect preserves exact transaction/path/query on fixed content gateway subdomains", () => {
  const tx = "a".repeat(43),
    base = `https://arweave.net/${tx}?ext=mp3`,
    sub = `https://${"a".repeat(52)}.arweave.net/${tx}?ext=mp3`;
  assert.equal(allowedBpmRedirect(base, sub, bpmMediaCandidates(base)), true);
  assert.equal(
    allowedBpmRedirect(
      base,
      sub.replace(".net/" + tx, ".net/" + "b".repeat(43)),
      bpmMediaCandidates(base),
    ),
    false,
  );
});
test("headers timeout and rate limits are recorded; no retries hammer the same host", () =>
  temporary(async (path) => {
    let call = 0,
      rateLimits = 0;
    const result = await downloadBpmMedia(source, path, {
      connectionTimeoutMs: 10,
      totalTimeoutMs: 200,
      onRateLimit: () => rateLimits++,
      fetcher: async () => {
        call++;
        if (call === 1) return new Promise(() => {});
        if (call === 2) return new Response(null, { status: 429 });
        return new Response("audio");
      },
    });
    assert.equal(result.attempts[0].reason, "connect-timeout");
    assert.equal(result.attempts[1].status, 429);
    assert.equal(rateLimits, 1);
    assert.equal(call, 3);
  }));
test("unsolicited partial range is never treated as complete original media", () =>
  temporary(async (path) => {
    await assert.rejects(
      downloadBpmMedia(source, path, {
        fetcher: async () =>
          new Response("tiny", {
            status: 206,
            headers: { "content-range": "bytes 0-3/1000000" },
          }),
      }),
      (e) => e.reason === "partial-response",
    );
    await assert.rejects(access(path));
  }));
test("stalled partial bodies remain deferred after bounded alternates, not a global provider outage", () =>
  temporary(async (path) => {
    let calls = 0;
    await assert.rejects(
      downloadBpmMedia(source, path, {
        idleTimeoutMs: 10,
        totalTimeoutMs: 200,
        maxBytes: 100,
        fetcher: async () => {
          calls++;
          return new Response(
            new ReadableStream({
              start(c) {
                c.enqueue(new Uint8Array([1]));
              },
              cancel() {},
            }),
          );
        },
      }),
      (error) =>
        error.deferred &&
        error.reason === "idle-timeout" &&
        error.attempts.length === 3 &&
        error.attempts.every((a) => a.bytes === 1),
    );
    assert.equal(calls, 3);
    await assert.rejects(access(path));
  }));

test("failed network attempts retain DNS and socket cause codes, remain retryable, and clean temporary audio", () =>
  temporary(async (path) => {
    let calls = 0;
    await assert.rejects(
      downloadBpmMedia(source, path, {
        fetcher: async () => {
          calls++;
          const cause =
            calls === 1
              ? Object.assign(new Error("private internal details"), {
                  code: "ENOTFOUND",
                })
              : Object.assign(
                  new AggregateError([
                    Object.assign(new Error("internal address"), {
                      code: "ECONNRESET",
                    }),
                    Object.assign(new Error("internal address"), {
                      code: "ETIMEDOUT",
                    }),
                  ]),
                  { code: "ETIMEDOUT" },
                );
          throw new TypeError("fetch failed", { cause });
        },
      }),
      (error) => {
        assert.equal(error.retryable, true);
        assert.equal(error.reason, "network-error");
        assert.deepEqual(error.attempts[0].errorCodes, ["ENOTFOUND"]);
        assert.deepEqual(error.attempts[1].errorCodes, [
          "ETIMEDOUT",
          "ECONNRESET",
        ]);
        assert.equal(
          JSON.stringify(error.attempts).includes("private internal"),
          false,
        );
        return true;
      },
    );
    assert.equal(calls, 3);
    await assert.rejects(access(path));
  }));
