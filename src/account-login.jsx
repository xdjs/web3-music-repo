import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import {
  PrivyProvider,
  usePrivy,
  useLinkAccount,
  useWallets,
  useConnectWallet,
} from "@privy-io/react-auth";
import { AccountProfile } from "./account-profile.jsx";
function Account() {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const [account, setAccount] = useState(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(null),
    [busy, setBusy] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);
  useEffect(() => {
    const attach = () => {
      const target = document.getElementById("profile-account");
      if (target && !target.querySelector(".profile-account-card"))
        target.replaceChildren();
      setProfileTarget(target);
    };
    attach();
    document.addEventListener("mn:route", attach);
    return () => document.removeEventListener("mn:route", attach);
  }, []);
  const [walletStatus, setWalletStatus] = useState("");
  const { wallets } = useWallets();
  const { linkWallet } = useLinkAccount({
    onSuccess: () =>
      setWalletStatus("Wallet added to your Music Nerd account."),
    onError: () =>
      setWalletStatus(
        "Wallet wasn’t linked. If it belongs to another account, sign in to that account first. You can also retry.",
      ),
  });
  const { connectWallet } = useConnectWallet({
    onSuccess: () =>
      setWalletStatus(
        "Wallet connected in this browser. Only wallets linked to your Music Nerd account appear above.",
      ),
    onError: () =>
      setWalletStatus("Connection wasn’t completed. You can retry."),
  });
  async function request(path, options = {}) {
    const token = await getAccessToken();
    if (!token) throw Error("Sign in again");
    const r = await fetch(path, {
      ...options,
      headers: { ...options.headers, Authorization: "Bearer " + token },
    });
    const d = await r.json();
    if (!r.ok)
      throw Error(
        d.error ||
          (r.status === 409
            ? "Saved playlists changed. Load the latest library before saving."
            : "Account request failed"),
      );
    return d;
  }
  useEffect(() => {
    let cancelled = false;
    setAccount(null);
    setRevision(null);
    setError("");
    if (authenticated) {
      (async () => {
        try {
          const a = await request("/api/account");
          const library = await request("/api/account/playlists");
          if (!cancelled) {
            setAccount(a);
            setRevision(library.revision);
          }
        } catch (e) {
          if (!cancelled) setError(e.message);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [authenticated, user?.id]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const playlists = JSON.parse(
        localStorage.getItem("mn-archive-playlists-v1") || "[]",
      );
      const d = await request("/api/account/playlists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, playlists }),
      });
      setRevision(d.revision);
      setError("Playlists saved to your account on this archive server.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    if (
      !confirm(
        "Replace this browser’s playlists with your saved account library? Export your local playlists first if you want to keep both.",
      )
    )
      return;
    setBusy(true);
    try {
      const d = await request("/api/account/playlists");
      localStorage.setItem(
        "mn-archive-playlists-v1",
        JSON.stringify(d.playlists),
      );
      location.hash = "me?tab=playlists";
      location.reload();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="account-control">
      {authenticated ? (
        <a className="outline-button" href="#me">
          My profile
        </a>
      ) : (
        <button className="outline-button" disabled={!ready} onClick={login}>
          Sign in
        </button>
      )}
      {profileTarget &&
        createPortal(
          <AccountProfile
            ready={ready}
            authenticated={authenticated}
            name={account?.name}
            linkedAccounts={user?.linkedAccounts || []}
            wallets={wallets}
            onLogin={login}
            onLink={() => {
              setWalletStatus("");
              linkWallet();
            }}
            onConnect={() => connectWallet()}
            onLogout={logout}
            onSave={save}
            onLoad={load}
            canSync={!!account && revision !== null}
            busy={busy}
            status={
              error ||
              (authenticated && !account
                ? "Verifying your Music Nerd account…"
                : "")
            }
            walletStatus={walletStatus}
          />,
          profileTarget,
        )}
    </div>
  );
}
function accountUnavailable(message) {
  document.getElementById("account-root").innerHTML =
    '<a class="outline-button" href="#me">My profile</a>';
  const show = () => {
    const target = document.getElementById("profile-account");
    if (target) {
      const p = document.createElement("p");
      p.className = "notice";
      p.textContent = message;
      target.replaceChildren(p);
    }
  };
  show();
  document.addEventListener("mn:route", show);
}
fetch("/api/auth/config")
  .then((r) => r.json())
  .then((c) => {
    if (!c.enabled)
      return accountUnavailable(
        "Sign-in is not configured on this copy. You can still browse public wallets and keep playlists in this browser.",
      );
    createRoot(document.getElementById("account-root")).render(
      <PrivyProvider
        appId={c.appId}
        config={{
          appearance: {
            theme: "dark",
            accentColor: "#E91E8C",
            logo: "/musicnerd-lenses.png",
          },
          loginMethods: ["email", "wallet"],
          embeddedWallets: { ethereum: { createOnLogin: "off" } },
        }}
      >
        <Account />
      </PrivyProvider>,
    );
  })
  .catch(() =>
    accountUnavailable(
      "Account connection is unavailable. Reload to retry; your browser playlists remain available.",
    ),
  );
