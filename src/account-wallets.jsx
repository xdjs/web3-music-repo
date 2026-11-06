import React from "react";
import { linkedWallets } from "./account-client.mjs";
export function AccountWallets({
  linkedAccounts = [],
  connected = [],
  onLink,
  onConnect,
  status = "",
}) {
  const wallets = linkedWallets(linkedAccounts);
  return (
    <section className="account-wallets" aria-label="Your linked wallets">
      <h3>Your wallets</h3>
      <p className="link-note">
        Wallets linked to your Music Nerd account, including wallets you use on
        other devices.
      </p>
      {wallets.length ? (
        <ul>
          {wallets.map((w) => {
            const isConnected = connected.some(
              (c) =>
                (w.chainType || "ethereum") === "ethereum" &&
                c.address?.toLowerCase() === w.address.toLowerCase(),
            );
            return (
              <li key={`${w.chainType}:${w.address}`}>
                <code title={w.address}>
                  {w.address.slice(0, 8)}…{w.address.slice(-6)}
                </code>
                {(w.chainType || "ethereum") === "ethereum" &&
                  /^0x[0-9a-f]{40}$/i.test(w.address) && (
                    <a
                      className="text-button"
                      href={"#me?tab=collection&wallet=" + w.address}
                    >
                      Listen to this wallet ↗
                    </a>
                  )}
                <small>
                  {w.walletClientType === "privy"
                    ? "Music Nerd wallet"
                    : "External wallet"}{" "}
                  · {w.chainType || "ethereum"}
                  {isConnected ? " · Connected" : " · Linked"}
                </small>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="link-note">
          No wallets linked yet. Add the wallet you collected music with.
        </p>
      )}
      <div className="actions">
        <button className="outline-button" onClick={onLink}>
          Add a wallet to my account
        </button>
        {wallets.some((w) => w.walletClientType !== "privy") && (
          <button className="text-button" onClick={onConnect}>
            Connect a linked wallet
          </button>
        )}
      </div>
      <p className="link-note">
        Adding a wallet requires a signature to confirm ownership. It becomes a
        sign-in method for this account.
      </p>
      <p className="link-note" role="status">
        {status}
      </p>
    </section>
  );
}
