import React from "react";
import { AccountWallets } from "./account-wallets.jsx";

export function AccountProfile({
  ready,
  authenticated,
  name,
  linkedAccounts,
  wallets,
  onLogin,
  onLink,
  onConnect,
  onLogout,
  onSave,
  onLoad,
  canSync,
  busy,
  status,
  walletStatus,
  onRetry,
  showRetry,
  needsMusicNerdAccount,
}) {
  return (
    <section className="profile-account-card" aria-label="Music Nerd account">
      <div className="section-head">
        <div>
          <h2>
            {authenticated
              ? name || "Music Nerd listener"
              : "Your Music Nerd account"}
          </h2>
          <p>
            {authenticated
              ? "Your linked wallets and saved library."
              : "Sign in with your existing Music Nerd account to see and link your wallets."}
          </p>
        </div>
        {authenticated ? (
          <button className="text-button" onClick={onLogout}>
            Sign out
          </button>
        ) : (
          <button className="primary" disabled={!ready} onClick={onLogin}>
            Sign in
          </button>
        )}
      </div>
      {authenticated && (
        <>
          <AccountWallets
            linkedAccounts={linkedAccounts}
            connected={wallets}
            onLink={onLink}
            onConnect={onConnect}
            status={walletStatus}
          />
          <div className="actions">
            <button
              className="outline-button"
              disabled={!canSync || busy}
              onClick={onSave}
            >
              Save playlists to account
            </button>
            <button
              className="outline-button"
              disabled={!canSync || busy}
              onClick={onLoad}
            >
              Load account playlists
            </button>
          </div>
          <p className="link-note">
            Playlists below are saved in this browser. Save or load to copy them
            to or from your Music Nerd account.
          </p>
        </>
      )}
      {needsMusicNerdAccount && (
        <a
          className="text-button"
          href="https://musicnerd.net"
          target="_blank"
          rel="noreferrer"
        >
          Open Music Nerd to finish account setup ↗
        </a>
      )}
      {showRetry && (
        <button className="outline-button" onClick={onRetry}>
          Retry account connection
        </button>
      )}
      <p role="status" className="link-note">
        {status}
      </p>
    </section>
  );
}
