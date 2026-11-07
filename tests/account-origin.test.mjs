import test from "node:test";
import assert from "node:assert/strict";
import { isAccountWriteOriginAllowed } from "../src/account-origin.mjs";

test("renamed origin configuration retains the original browser playlist migration path", () => {
  const configuration = {
    archiveOrigin: "https://web3-music-archive.vercel.app",
    deploymentHostname: "specific-release-musicnerd.vercel.app",
  };
  for (const origin of [
    "https://web3-music-archive.vercel.app",
    "https://web3-music-repo.vercel.app",
    "https://specific-release-musicnerd.vercel.app",
    "http://127.0.0.1:4190",
    undefined,
  ])
    assert.equal(isAccountWriteOriginAllowed(origin, configuration), true);
  for (const origin of [
    "null",
    "",
    "https://attacker.vercel.app",
    "https://web3-music-repo.vercel.app.attacker.test",
    "https://web3-music-repo.vercel.app@attacker.test",
    "https://web3-music-repo.vercel.app/path",
    "http://web3-music-repo.vercel.app",
    ["https://web3-music-repo.vercel.app"],
  ])
    assert.equal(isAccountWriteOriginAllowed(origin, configuration), false);
});
