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
  syncStatus,
  onSyncRetry,
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
          <p className="link-note" role="status" data-account-playlist-status>
            {syncStatus?.message || "Connecting playlist sync…"}
          </p>
          {syncStatus?.canRetry && (
            <button className="outline-button" onClick={onSyncRetry}>
              Retry playlist sync
            </button>
          )}
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
