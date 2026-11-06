# Durable private account playlists

Account playlists now support a dedicated **private Vercel Blob store**. The canonical Music Nerd database remains read-only and supplies only the authenticated account identity. Browser-local playlists retain their existing behavior; Save/Load explicitly copies between the browser and account storage.

## Correctness and privacy

`src/account-durable-store.mjs` stores one JSON document per canonical account UUID and environment namespace. Stored documents include schema version and account identity; these must match on every read. Client-supplied account identifiers are never used by the API. Validation limits library size and accepted fields.

Reads use `get(..., {access: 'private', useCache: false})`, including the read before a write and the read after a conflict. The provider's current ETag protects updates through `put(..., {allowOverwrite: true, ifMatch: etag})`. The numeric revision remains the browser/API conflict contract. First creation uses `allowOverwrite: false` so two new writers cannot overwrite one another. No process-local lock is required for cross-instance correctness.

A lost write acknowledgment or create race triggers a fresh read. A changed revision returns the existing HTTP 409 conflict response. The adapter never retries an unconditional write. Provider errors, corrupt JSON, invalid account envelopes, unexpected public URLs and oversize documents fail closed; they do not become empty successful libraries.

Private Blob URLs and credentials are never returned by the account API. Account responses carry `no-store`; no public upload/download or signed-sharing route is added.

The behavior follows Vercel's [conditional write guarantees](https://vercel.com/docs/vercel-blob#conditional-writes), [SDK options and consistent reads](https://vercel.com/docs/vercel-blob/using-blob-sdk), and [OIDC authentication](https://vercel.com/changelog/vercel-blob-now-supports-oidc-authentication).

## Deployment configuration

Root provisions and connects a new private store to this recovery project's environments. Do not reuse a public media store or write playlist state into Music Nerd's canonical database.

- Install current `@vercel/blob` supporting private storage, OIDC, `ifMatch` and `useCache: false`.
- Connected Vercel projects use `BLOB_STORE_ID` and runtime OIDC; the SDK obtains rotating credentials. A static `BLOB_READ_WRITE_TOKEN` is supported for controlled local/existing configurations but stays server-only.
- `ACCOUNT_PLAYLIST_NAMESPACE` optionally specifies a lowercase letters/digits/hyphen/underscore namespace. Defaults are `production`, `preview`, or `development` based on `VERCEL_ENV`. Separate stores per environment offer stronger access separation; prefixes prevent accidental cross-environment collisions in one store.
- Storage paths are `account-playlists-v1/<namespace>/<canonical-uuid>.json`.

`account-api.mjs` chooses Blob when its store ID or token is configured. On Vercel, absent durable configuration produces HTTP 503 for playlist operations; it never silently writes ephemeral function files. Local development without Blob configuration retains the existing private filesystem store. `/api/auth/config` and `/api/account` report the selected storage mode without exposing credentials.

Existing local-server account libraries are not migrated automatically. Browser Save can create the account library after deployment. A future explicit migration must preserve canonical account IDs and revisions and must not publish source files.

## Verification

Nine new adapter tests plus the two existing account tests pass. New tests use independent adapter instances sharing an atomic provider model and cover first-write races, ETag update races, stale revisions, identity/environment isolation, forged paths/fields, corrupted saved data, oversized documents, provider errors, private-only responses and timed-out write acknowledgments.

```sh
node --test tests/account-durable-store.test.mjs tests/account.test.mjs
```

A real-provider synthetic-account probe passed on November 6, 2026 at 08:55:47 UTC against the newly provisioned private store using installed `@vercel/blob` 2.8.2. Seven checks passed: missing-account read, concurrent first writes with one winner, cross-instance persistence, concurrent ETag-protected updates with one winner, stale revision conflict, account isolation, and anonymous direct-read denial (HTTP 403). Its exact random test paths were conditionally deleted and strongly read back as absent. No real account library was touched. Evidence is `data/account-durable-store-live.json`; the repeatable probe is `scripts/account-durable-probe.mjs`.

The probe verifies the actual storage provider, separately from mock tests. It does not verify a real Music Nerd email/wallet session or deployed end-to-end account save/load; those remain signed-in checks. The local direct Node command initially lacked network access; the completed run used the workspace's approved Node launch path without exposing credentials.
