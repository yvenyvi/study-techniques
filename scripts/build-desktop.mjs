import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const publicKey = process.env.STUDY_ROOM_UPDATER_PUBLIC_KEY?.trim();
const signingKeyPresent = Boolean(
  process.env.TAURI_SIGNING_PRIVATE_KEY?.trim(),
);
if (
  Boolean(publicKey) !== signingKeyPresent ||
  (process.env.STUDY_ROOM_REQUIRE_UPDATER === "1" && !publicKey)
) {
  throw Error(
    "Signed releases require both the STUDY_ROOM_UPDATER_PUBLIC_KEY repository variable and TAURI_SIGNING_PRIVATE_KEY Actions secret. See docs/DESKTOP_UPDATES.md.",
  );
}
const directory = mkdtempSync(join(tmpdir(), "study-room-build-"));
try {
  const args = [
    resolve("node_modules/@tauri-apps/cli/tauri.js"),
    "build",
    ...process.argv.slice(2),
  ];
  if (publicKey) {
    const config = join(directory, "updater.json");
    writeFileSync(
      config,
      JSON.stringify({
        bundle: { createUpdaterArtifacts: true },
        plugins: { updater: { pubkey: publicKey } },
      }),
    );
    args.push("--config", config);
  }
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
