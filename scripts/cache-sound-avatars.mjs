import { readFile, writeFile, mkdir } from "node:fs/promises";
const profiles = JSON.parse(await readFile("data/historical-profiles.json"));
await mkdir("public/collectors", { recursive: true });
let index = 0;
async function worker() {
  while (index < profiles.length) {
    const p = profiles[index++];
    if (!p.avatarURL || p.localAvatar) continue;
    try {
      const u = new URL(p.avatarURL);
      if (u.hostname !== "d2i9ybouka0ieh.cloudfront.net") continue;
      const r = await fetch(u, {
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error(r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (
        buf.length > 5000000 ||
        !(
          (buf[0] === 137 && buf.subarray(1, 4).toString() === "PNG") ||
          (buf[0] === 255 && buf[1] === 216) ||
          buf.subarray(0, 3).toString() === "GIF" ||
          (buf.subarray(0, 4).toString() === "RIFF" &&
            buf.subarray(8, 12).toString() === "WEBP")
        )
      )
        throw Error("invalid image");
      p.localAvatar = `/collectors/${p.address}.img`;
      await writeFile("public" + p.localAvatar, buf);
      p.avatarRetrievedAt = new Date().toISOString();
      delete p.avatarFailure;
      console.log("cached", p.name);
    } catch (e) {
      p.avatarFailure = String(e.message);
      console.log("unavailable", p.name);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
await writeFile(
  "data/historical-profiles.json",
  JSON.stringify(profiles, null, 2) + "\n",
);
