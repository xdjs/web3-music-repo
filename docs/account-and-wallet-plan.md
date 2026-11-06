# Account and collection listening

Priority agreed with Pete: reliable playback and artist search, then personal playlists, then Music Nerd identity/sync and wallet collections. Current playlists use browser storage and export stable chain + contract + token identifiers; no fake sign-in is presented.

## Implemented locally — verification still open

Production Music Nerd Privy app ID and read-only canonical user lookup are configured from Vercel. JWT verification checks signature, issuer, audience and expiry. Account playlist GET/PUT resolves the canonical user server-side and uses private archive-server files with per-user isolation, atomic replacement and revision conflicts. No production user or playlist database writes are made.

Login UI renders, but a real user attempt failed. The confirmed cause is HTTP 403 `invalid_origin`: the production app does not allow `http://127.0.0.1:4190`. This exact preview origin must be temporarily allowed in Privy before email authentication can succeed. Remove local access after development. Real signed-in save/load remains unverified. Browser control of the Privy dashboard was unavailable in this session.

The private filesystem store is suitable for this local server, not an ephemeral serverless deployment. Production release also needs review of the 29 transitive dependency audit findings (11 moderate, 18 high) in the current Privy wallet dependency tree; the nonbreaking audit fix did not resolve them.

## Existing Music Nerd flow inspected

Local MusicNerdWeb files:
- `src/app/_components/PrivyProviderWrapper.tsx`: same Privy app, email login, Music Nerd pink/logo, no automatic embedded wallet creation.
- `src/app/_components/nav/components/PrivyLogin.tsx`: obtains a Privy token and establishes a NextAuth session.
- `src/server/auth.ts`: verifies token server-side, looks up Music Nerd user by Privy ID, creates the mapped user only when necessary.
- `src/server/utils/privy.ts`: token verification. Development-only identity shortcuts are not production authentication.

Recommended integration: host the recovery app under Music Nerd's application/session boundary or add an authenticated Music Nerd API. Reuse its Privy app and canonical Music Nerd user ID; a separate origin does not automatically share its NextAuth cookie. Confirm allowed origins and callback configuration. Store playlist ownership on that server-verified user ID, never an email/address supplied by the browser. Add per-user access control, migration of local playlists after login, conflict/version handling and export. Keep server credentials in ignored private environment configuration; never send them to the browser or execute historical Sound client keys.

## Wallet collection iteration

After authentication, optionally link an external wallet using the existing Privy identity. A public address lookup can be read-only; linking it to an account requires proof of control. Never request a mint, token approval or asset transfer to listen.

Query supported chains separately, paginate fully and retain errors/cursors. Identify assets by chain ID + contract + token ID (and balance for ERC1155). Resolve metadata and playable audio/video through the existing reader; image-only NFTs are not automatically songs. Separate current holdings from historical mint/purchase activity, because sold/transferred tokens won't appear in current holdings.

Let users add resolved recordings to the same playlists. Preserve unavailable entries and their original references so they can be retried. Collapse duplicate editions only in the listening view while retaining every ownership record. Scope each collection scan to a timestamp/block or documented indexer snapshot; do not claim a complete wallet history from one page.

## Sound expansion

Verify Ethereum/Optimism deployment versions and factory events, then enumerate editions and mint/transfer histories. Existing V2-named imported checkpoints sometimes identify themselves as version 1: they are not evidence of complete V2 recovery. Extend to other chains only with deployment evidence. Map archived Sound track IDs to token identities without guessing by title alone.

## Wallet controls added

The archive enables email + Ethereum wallet login in its PrivyProvider. The production app's public configuration confirms `wallet_auth: true` and `solana_wallet_auth: false`; existing allowed origins still exclude the local preview.

My account now derives its wallet list from Privy `user.linkedAccounts`, including embedded and external wallet entries, rather than using only currently connected browser wallets. `useWallets` supplies the separate connected status. `useLinkAccount().linkWallet()` adds a wallet with Privy's ownership-verification flow; `useConnectWallet` reconnects a browser wallet without treating connection alone as account linkage. No client-supplied wallet list is persisted or used as server-side authorization.

Presentation was browser-checked with a synthetic linked-wallet fixture (separate from production authentication). Actual wallet sign-in, signatures, linking conflicts and persistence across devices remain unverified because local login is rejected by the allowed-origin configuration. Existing Music Nerd users should sign in to their existing account before adding an unlinked wallet. A wallet-first sign-in can create a different Privy identity; automatic account merging is not implemented. First-time canonical Music Nerd user creation, verified server-side wallet retrieval, multi-chain holdings discovery, durable playlist sync and wallet library playback remain required.

## Public wallet library implemented

`/api/wallet/:address` reads current indexed NFT holdings on a fixed per-chain host, preserving uint256 IDs and validating cursor fields. The UI permits explicit per-network scan/retry/next-page actions and retains loaded results on failures. It matches exact chain/contract/token IDs, or a unique recording within a factory-verified Sound release contract, or encoded legacy edition IDs. Unmatched NFTs are counted and retained in scan state. Sequential legacy IDs and arbitrary new audio metadata still need resolution. A real Ethereum wallet sample returned 48 held entries mapping to seven recovered recordings. Linked Ethereum wallets have a Listen to this wallet link; wallet signatures/account linking are still blocked by the local allowed-origin setting.
