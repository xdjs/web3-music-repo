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

No email OTP was sent and no wallet signature was requested. Pete still needs to complete one real login, link a wallet if desired, and save/load a playlist. The real login screen is verified; the personal authenticated transaction remains unverified.

Guest playlists remain browser-local. Local account playlists use filesystem storage. The production integration now supports private Vercel Blob storage with per-account isolation and conditional revision writes; the release orchestrator configured and tested that durable adapter. A real personal login and playlist save/load remain separate checks from storage-adapter tests.

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
