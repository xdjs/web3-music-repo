import { jwtVerify, importSPKI } from "jose";
export async function verifyAccountToken(token, config) {
  if (typeof token !== "string" || token.length > 16384)
    throw Error("Invalid access token");
  const key = await importSPKI(config.verificationKey, "ES256");
  const { payload } = await jwtVerify(token, key, {
    issuer: "privy.io",
    audience: config.appId,
    algorithms: ["ES256"],
    requiredClaims: ["sub", "exp", "iat"],
    maxTokenAge: "1h",
  });
  if (!/^did:privy:[a-zA-Z0-9:_-]+$/.test(payload.sub || ""))
    throw Error("Invalid identity");
  return payload.sub;
}
