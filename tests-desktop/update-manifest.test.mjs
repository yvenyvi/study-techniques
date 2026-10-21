import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { prepareDesktopRelease } from "../scripts/prepare-desktop-release.mjs";

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "study-release-test-"));
  const bundleDir = join(root, "bundle"),
    outputDir = join(root, "release");
  await mkdir(bundleDir);
  const installer = Buffer.from("test installer bytes");
  await writeFile(join(bundleDir, "Study_Room_1.4.0_x64-setup.exe"), installer);
  try {
    await run({
      bundleDir,
      outputDir,
      version: "1.4.0",
      notes: "Automatic updates",
      installer,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("signed feed references the versioned asset and preserves installer bytes and signature", () =>
  fixture(async (options) => {
    const signature = Buffer.from(
      "untrusted comment: fixture signature\nnot-a-real-signature",
    ).toString("base64");
    await writeFile(
      join(options.bundleDir, "Study_Room_1.4.0_x64-setup.exe.sig"),
      signature,
    );
    await prepareDesktopRelease({ ...options, requireSignature: true });
    const feed = JSON.parse(
      await readFile(join(options.outputDir, "latest.json"), "utf8"),
    );
    assert.equal(feed.version, "1.4.0");
    assert.equal(feed.platforms["windows-x86_64"].signature, signature);
    assert.equal(
      feed.platforms["windows-x86_64"].url,
      "https://github.com/yvenyvi/study-techniques/releases/download/desktop-v1.4.0/Study-Room-Windows-x64-Setup.exe",
    );
    assert.deepEqual(
      await readFile(
        join(options.outputDir, "Study-Room-Windows-x64-Setup.exe"),
      ),
      options.installer,
    );
    assert.match(
      await readFile(join(options.outputDir, "SHA256SUMS.txt"), "utf8"),
      new RegExp(createHash("sha256").update(options.installer).digest("hex")),
    );
  }));
test("publishing refuses missing signatures", () =>
  fixture(async (options) => {
    await assert.rejects(
      prepareDesktopRelease({ ...options, requireSignature: true }),
      /unsigned update/,
    );
  }));
test("unsigned development builds remove stale feeds", () =>
  fixture(async (options) => {
    await mkdir(options.outputDir);
    await writeFile(join(options.outputDir, "latest.json"), "stale");
    await prepareDesktopRelease(options);
    await assert.rejects(readFile(join(options.outputDir, "latest.json")), {
      code: "ENOENT",
    });
  }));
test("ambiguous installers cannot be published", () =>
  fixture(async (options) => {
    await writeFile(join(options.bundleDir, "older-setup.exe"), "old");
    await assert.rejects(prepareDesktopRelease(options), /exactly one/);
  }));

test("signed build passes the verification key to the bundler and requires complete credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "study-build-config-"));
  const cli = join(root, "node_modules/@tauri-apps/cli");
  const script = fileURLToPath(
    new URL("../scripts/build-desktop.mjs", import.meta.url),
  );
  try {
    await mkdir(cli, { recursive: true });
    await writeFile(
      join(cli, "tauri.js"),
      `const fs = require('node:fs'); const i = process.argv.indexOf('--config'); console.log(fs.readFileSync(process.argv[i + 1], 'utf8'));`,
    );
    const env = {
      ...process.env,
      STUDY_ROOM_REQUIRE_UPDATER: "1",
      STUDY_ROOM_UPDATER_PUBLIC_KEY: "test-public-key",
      TAURI_SIGNING_PRIVATE_KEY: "test-private-key",
    };
    const result = spawnSync(process.execPath, [script, "--bundles", "nsis"], {
      cwd: root,
      env,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    assert.equal(config.bundle.createUpdaterArtifacts, true);
    assert.equal(config.plugins.updater.pubkey, "test-public-key");
    const missing = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { ...env, TAURI_SIGNING_PRIVATE_KEY: "" },
      encoding: "utf8",
    });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Signed releases require both/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
