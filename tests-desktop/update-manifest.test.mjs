import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
