# Music Nerd account and wallet connection — November 6, 2026

## Configured and verified

After Pete explicitly approved creating the recovery client, created **Music NFT Recovery — local** inside the existing Music Nerd Privy app. It shares the same Music Nerd users and linked wallets. It is not a separate user database.

- App: `cmlzjxfrh00ak0cjvlap9d3gm`.
- Client: `client-WY6W53j4q1dvp15KJx1zc88MivQTj6NJ66TZHLhFYf3X5` (a public identifier, not a secret).
- Client settings: https://dashboard.privy.io/apps/cmlzjxfrh00ak0cjvlap9d3gm/app-client/ab8w8uyi8dvlz9crznttprv88 .
- Exactly two allowed origins: `http://127.0.0.1:4190` and `http://localhost:4190`.
- Independent local client uses token storage rather than the production site's `musicnerd.net` HttpOnly cookie domain. The main app/default client's settings were not changed. The default client's original three origins were independently read back through Privy's public configuration API.
- Existing email and wallet login methods remain enabled; embedded wallet creation remains off.
- Dashboard reload confirmed persistence. Public app configuration with the new client returned HTTP 200 and the exact local origins.
- The actual SDK login modal now opens with email and wallet choices, correct Music Nerd lenses logo, both themes, desktop and mobile, with no 403 or JavaScript errors.

See `data/privy-client-config-verification.json`, `data/privy-login-verification.json`, and `captures/privy-login-*.png`.

## Implemented account flow

- `PrivyProvider` now receives a client ID. The backend resolves `PRIVY_CLIENT_ID` from the process environment or `.env.local`, falling back to the public client config. The active preview's private local environment is configured. No credentials were copied into Git.
- Login errors surface on My profile rather than disappearing into the SDK. Initial token availability is retried briefly; aborted/account-switched requests do not use a different account's token.
- Failed canonical account lookup has a retry button. A missing Music Nerd account includes an explicit Music Nerd setup link. The recovery app does not automatically create or merge canonical accounts.
- Existing linked wallets display from Privy's `user.linkedAccounts`, including wallets linked on other devices. Duplicate Ethereum addresses collapse without lowercasing Solana identities.
- Add wallet uses Privy's ownership-signature link flow. Browser connection is labeled separately from account linkage. No wallet transaction, delegated signer, or embedded-wallet creation is requested by this UI.
- Save/load retains optimistic revision conflict checks and the existing explicit overwrite confirmation. An account switch during a request cannot overwrite browser playlists with the previous account's response.
- Account UI follows the existing shared surfaces/buttons. Privy's theme now follows the page theme.
- Account builds write new chunks before replacing the entry, then remove obsolete generated JavaScript. A failed compile leaves previous assets intact.

## Validation and remaining personal check

Seven account/client unit tests pass. A separate full-app browser fixture with a mocked Privy SDK and mocked account HTTP responses passes linked-wallet display/add/connect, account setup retry, save/load of browser playlists, clearing wallet state after logout, and 1440/390px light/dark layouts. See `data/privy-profile-verification.json`. This fixture is not evidence of a real user's authentication or production account persistence.

No email OTP was sent and no wallet signature was requested by the agent. Pete’s later signed-in profile screenshot confirms that Privy exposes his real linked wallet. The collection issue was missing UI wiring, not a need to repeat sign-in. A new wallet-link signature and personal authenticated playlist save/load remain separate, unverified actions.

Guest playlists remain browser-local. Local account playlists use filesystem storage. The production integration now supports private Vercel Blob storage with per-account isolation and conditional revision writes; the release orchestrator configured and tested that durable adapter. Pete has since confirmed real sign-in and linked-wallet display; authenticated playlist save/load remains a separate personal check from storage-adapter tests.

## Recheck

Run `node --test tests/account.test.mjs tests/privy-client.test.mjs` and `npm run build:account`. With the real preview running on 4190, `node scripts/verify-privy-login.mjs` opens but does not submit the login modal. With the canonical preview on 4191, `node scripts/verify-privy-profile.mjs` runs the explicitly mocked account flow.

The local client does not authorize arbitrary preview/production hostnames. Production uses the dedicated client below through `PRIVY_CLIENT_ID`; preview domains require their own explicitly configured origins.

Official references: [Privy app clients](https://docs.privy.io/basics/get-started/dashboard/app-clients), [access tokens](https://docs.privy.io/authentication/user-authentication/access-tokens), and [allowed-domain security](https://docs.privy.io/security/implementation-guide/security-checklist).

## Production client — November 6, 09:26 UTC

Pete explicitly approved enabling login on the live site. Created and saved **Music NFT Recovery — production** inside the same Music Nerd Privy app:

- Public client ID: `client-WY6W53j4q1dvp15KJx1zc88MivQTj6NJ66S4CKzsxEAdJ`.
- Exactly one allowed origin: `https://web3-music-repo.vercel.app`.
- Dashboard: https://dashboard.privy.io/apps/cmlzjxfrh00ak0cjvlap9d3gm/app-client/bra9hpb2yt9ukr757ezcvbe0u .
- New client uses its own different-domain configuration; main app cookie and session settings were not changed. Email and wallet authentication remain enabled.
- Dashboard displayed “App client was updated successfully”. Independent public API read-back returned HTTP 200 and the exact single origin. Separate public API checks confirmed the default client's three origins and the local client's two origins are preserved.
- Evidence: `data/privy-production-client-verification.json`. Release orchestrator owns setting the production environment variable, redeployment, and real live modal verification. No OTP or wallet signature was requested during setup.

## Live production verification — 09:54 UTC

Deployment `dpl_EvGcZJyofBcXUXehfhyNQXZxGckt` serves the exact production client and reports `playlistStorage: private-blob`. The real Privy SDK login modal passed at 1440/390px in light/dark themes, with email and wallet choices, Music Nerd lenses, no overflow or JavaScript errors, and a successful HTTP 200 public configuration request. No invalid-origin response occurred. Evidence: `data/privy-production-login-verification.json`, `captures/privy-production-login-*.png`, `scripts/verify-production-login.mjs`. No OTP or wallet signature was sent; real account completion remains a personal test.

## Main release recheck — November 6, 10:36 UTC

Rechecked the stable production site after deployment `dpl_EzRjTGwjs26ny3bDyrUvDJnF1uEr` from merged main commit `e3458a1e29ff581dded2a90c0c6b19e454fa5548`. The actual Privy SDK modal still passes at 1440/390px in light/dark with the dedicated production client above, email and wallet options, HTTP200 public configuration, no invalid-origin response, no overflow, and no JavaScript errors. The live account configuration reports `private-blob` storage.

Evidence was refreshed in `data/privy-production-login-verification.json` and `captures/privy-production-login-*.png`. No authentication settings were changed during this recheck. No OTP or wallet signature was sent; the real personal sign-in and authenticated playlist save/load boundary remains unchanged.

## Linked collection and ENS fix — November 6, 17:10 UTC

The account component now publishes a minimal linked-EVM-wallet snapshot to the collection UI. My collection selects the first supported linked wallet when no explicit public-wallet query is present and starts one page on each of five supported networks, with at most two concurrent lookups. Additional pages remain explicit. Account switches and logout cancel old requests and clear automatic selection; an explicit public wallet remains a public selection. Loading, provider errors, empty pages, and unmatched tokens are distinct states. Network results replace only the collection results, preserving the account portal, form focus, scroll position and player node.

The same field accepts an ENS name on submission. Resolution is a public Ethereum lookup, not a way to link a wallet or prove account ownership. It preserves existing results while pending, displays failures inline, and discards responses after input, account or route changes. A successful result navigates to the normalized address and attributes the ENS name/source.

Four controller tests and four rendered viewport/theme cases pass with explicitly mocked Privy/account/wallet responses, including account-switch races, explicit public-query priority, pagination and logout. The additional ENS fixture checks invalid names and stale responses. A separate real browser check resolved `vitalik.eth` through the actual local backend to the expected address, with a visible source label and no overflow in all four views; only sign-in configuration was disabled in that public-lookup test. Evidence: `data/wallet-autoload-ui-verification.json`, `data/wallet-ens-ui-verification.json`, and `captures/wallet-{autoload,ens}-*.png`. This does not substitute for a complete live wallet census.

## Production wallet release — November 6, 17:27 UTC

Verified stable production deployment `dpl_ghLKKmV9ieeXNpJNPydkRJXmqvtK` from main `c79de1908a597fcb47dbde4afd4cba4c488044b3`. The actual Privy modal opens with email and wallet options at 1440/390px in both themes. Its public configuration returns HTTP 200 with the dedicated production client and private Blob playlist storage; no invalid-origin or JavaScript errors occurred. No OTP or signature was requested.

A real public My collection query for Pete's wallet automatically made exactly five first-page requests. Ethereum returned 50 token entries matching 20 recordings; Optimism returned 50 matching 18. Both have more pages. Base, Polygon and Zora returned provider errors during this check and remained visibly retryable; those results do not establish empty holdings. All four rendered layouts passed overflow checks. This was a guest public-address test; signed-in automatic selection and identity races are covered by the explicitly mocked account fixture, while Pete's supplied screenshot already establishes his real linked wallet.

The live ENS endpoint resolved `vitalik.eth` to `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`; the UI normalized the address and displayed the ENS source in all four layouts. ENS remains public lookup only, with no effect on Privy ownership or wallet linkage. Independent review confirmed a fixed Ethereum RPC, ENS normalization, disabled CCIP resolver HTTP requests, bounded timeouts and stale-response guards; 15 focused account/state/ENS tests passed.

Updated evidence: `data/wallet-production-ui-verification.json`, `data/wallet-ens-production-ui-verification.json`, `data/privy-production-login-verification.json`, and corresponding captures. The existing Lab listing's cookbook was updated through its creator-scoped API at `2026-11-06T17:27:18.794205+00:00`, retaining Pete Rango's originator credit, thumbnail, description, recipe and main source link. Database read-back and 1440/390px rendered checks confirmed the new collection/ENS/shuffle/queue/buffering paragraph. Evidence: `data/lab-update-persistence.json` and `data/lab-submission-verification.json`. Lab's pre-existing 2px mobile page overflow remains recorded; no Lab application code changed.

## Embedded account entry — November 6 follow-up

The account build now starts with `src/account-entry.mjs`. In an iframe, it does not import or initialize Privy. Existing header and profile-card styling presents an explicit native link to this same app's top-level `/#me` in a new tab, using `noopener noreferrer`. The embedded listening page remains open. Public wallet lookup and browser playlists remain available; account-linked wallet state is explicitly unavailable in that frame instead of remaining in a loading state. The standalone page retains the existing account implementation and ownership-verification flow.

`src/account-context.mjs` contains bounded context detection and same-origin destination construction. No Privy client/origin settings, global Music Nerd auth configuration, wallet verification, account API or CSP was weakened. This prevents nested Privy frames and wallet-provider probing inside Lab. It does not claim to fix the separate top-level WebKit error from auth.privy.io's Cloudflare fullscreen-policy probe.

Local cross-origin sandbox QA matches Lab's iframe sandbox flags. Chromium 1440/390 light/dark and WebKit 390 dark render with no nested auth frames or auth-config/Privy requests. The sign-in link opens a genuine top-level page without an opener, and the existing standalone account module loads. No OTP/signature was sent. Local 4191 account configuration is not a successful real-login test; production modal verification remains a deployment check. Evidence: `data/embedded-account-verification.json` and `captures/embedded-account-*.png`.

Production verification completed after deployment `dpl_8tQvc6RN2exVwzfTSD4yYdVRNzpN` from main `2e614775e1526b7376bb26fb164409d36a531ab3`. The actual Lab iframe rendered the new account card with zero nested frames, Privy requests or standalone SDK imports. Its native sign-in link opened the stable recovery origin in a top-level tab with `opener === null`. The real Privy email/wallet modal opened there, its app request returned HTTP200, and private-Blob account configuration remained enabled. Desktop light and mobile dark screenshots were visually inspected; no page errors or 403 responses occurred in this Chromium run. No OTP, signature or account mutation was performed. Evidence: `data/production-embedded-account-verification.json`, `captures/production-lab-account-escape-1440.png`, and `captures/production-account-escape-login-{1440-light,390-dark}.png`. This fixes the embedded entry path; it does not establish resolution of the separate previously observed WebKit challenge-script warning.
