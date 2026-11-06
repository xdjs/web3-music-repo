import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { verifyAccountToken } from "./verify-account-token.mjs";
import { createAccountPlaylistStore } from "./account-playlist-store.mjs";
import { createDurableAccountPlaylistStore } from "./account-durable-store.mjs";
let env = {};
try {
  env = parseEnv(readFileSync(".env.local", "utf8"));
} catch {}
const publicConfig = JSON.parse(readFileSync("data/privy-public-config.json"));
const dbURL =
  process.env.MUSICNERD_DB_CONNECTION || env.MUSICNERD_DB_CONNECTION;
const sql = dbURL
  ? postgres(dbURL, {
      max: 2,
      connect_timeout: 10,
      ssl: "require",
      connection: {
        application_name: "music-archive-identity",
        default_transaction_read_only: "on",
      },
    })
  : null;
const blobStoreId = process.env.BLOB_STORE_ID || env.BLOB_STORE_ID;
const blobToken =
  process.env.BLOB_READ_WRITE_TOKEN || env.BLOB_READ_WRITE_TOKEN;
const durableConfigured = !!(blobStoreId || blobToken);
const storageKind = durableConfigured
  ? "private-blob"
  : process.env.VERCEL
    ? "unavailable"
    : "archive-server";
const store = durableConfigured
  ? createDurableAccountPlaylistStore({
      storeId: blobStoreId,
      // Let Vercel's SDK obtain rotating OIDC credentials in deployed functions.
      token: process.env.VERCEL && blobStoreId ? undefined : blobToken,
      namespace:
        process.env.ACCOUNT_PLAYLIST_NAMESPACE ||
        env.ACCOUNT_PLAYLIST_NAMESPACE ||
        (process.env.VERCEL_ENV === "production"
          ? "production"
          : process.env.VERCEL_ENV === "preview"
            ? "preview"
            : "development"),
    })
  : process.env.VERCEL
    ? {
        read: async () => {
          throw Error("Durable account storage unavailable");
        },
        write: async () => {
          throw Error("Durable account storage unavailable");
        },
      }
    : createAccountPlaylistStore(
        process.env.ACCOUNT_PLAYLIST_DIR ||
          env.ACCOUNT_PLAYLIST_DIR ||
          "private/account-playlists",
      );

export async function accountAPI(req, res, url, json) {
  if (url.pathname === "/api/auth/config") {
    json(res, {
      enabled: !!sql,
      appId: publicConfig.appId,
      clientId:
        process.env.PRIVY_CLIENT_ID ||
        env.PRIVY_CLIENT_ID ||
        publicConfig.clientId ||
        null,
      mode: "Music Nerd production identity; private account playlist storage",
      playlistStorage: storageKind,
    });
    return true;
  }
  if (!url.pathname.startsWith("/api/account")) return false;
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  try {
    if (!["GET", "PUT"].includes(req.method))
      return (json(res, { error: "Method not allowed" }, 405), true);
    const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(
      req.headers.authorization || "",
    );
    if (!match)
      return (json(res, { error: "Sign in to Music Nerd" }, 401), true);
    let privyId;
    try {
      privyId = await verifyAccountToken(match[1], publicConfig);
    } catch {
      return (
        json(res, { error: "Session expired or invalid. Sign in again." }, 401),
        true
      );
    }
    if (!sql)
      return (
        json(res, { error: "Music Nerd account lookup unavailable" }, 503),
        true
      );
    const rows =
      await sql`select id, username from public.users where privy_user_id=${privyId} limit 1`;
    const account = rows[0];
    if (!account)
      return (
        json(
          res,
          {
            error:
              "Open musicnerd.net and sign in once to establish your Music Nerd account, then return here.",
            needsMusicNerdAccount: true,
          },
          409,
        ),
        true
      );
    if (url.pathname === "/api/account" && req.method === "GET")
      return (
        json(res, {
          id: account.id,
          name: account.username || "Music Nerd listener",
          storage: storageKind,
        }),
        true
      );
    if (url.pathname !== "/api/account/playlists")
      return (json(res, { error: "Not found" }, 404), true);
    if (req.method === "GET")
      return (json(res, await store.read(account.id)), true);
    if (
      req.headers.origin &&
      ![
        "http://127.0.0.1:4190",
        "http://localhost:4190",
        process.env.ARCHIVE_ORIGIN || env.ARCHIVE_ORIGIN,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      ]
        .filter(Boolean)
        .includes(req.headers.origin)
    )
      return (json(res, { error: "Invalid request origin" }, 403), true);
    const chunks = [];
    let body = "",
      bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 500000)
        return (json(res, { error: "Playlist library too large" }, 413), true);
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString("utf8");
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw Error("Invalid playlists");
    }
    if (!data || typeof data !== "object") throw Error("Invalid playlists");
    if (
      !Number.isSafeInteger(data.revision) ||
      data.revision < 0 ||
      !Array.isArray(data.playlists) ||
      data.playlists.length > 100
    )
      throw Error("Invalid playlists");
    const ids = new Set();
    const playlists = data.playlists.map((p) => {
      if (
        !p ||
        typeof p !== "object" ||
        typeof p.id !== "string" ||
        p.id.length > 100 ||
        ids.has(p.id) ||
        typeof p.name !== "string" ||
        !p.name.trim() ||
        p.name.length > 100 ||
        !Array.isArray(p.recordIds) ||
        p.recordIds.length > 5000 ||
        p.recordIds.some((id) => typeof id !== "string" || id.length > 200)
      )
        throw Error("Invalid playlists");
      ids.add(p.id);
      return {
        id: p.id,
        name: p.name,
        recordIds: p.recordIds,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });
    const result = await store.write(account.id, data.revision, playlists);
    json(res, result, result.conflict ? 409 : 200);
    return true;
  } catch (e) {
    json(
      res,
      {
        error:
          e.message === "Invalid playlists"
            ? "Invalid playlist library"
            : "Account service temporarily unavailable",
      },
      e.message === "Invalid playlists" ? 400 : 503,
    );
    return true;
  }
}
