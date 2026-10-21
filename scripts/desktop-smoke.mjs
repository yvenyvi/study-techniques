// Runs the actual compiled Windows app through WebView2's development CDP port.
// The debugging switch is set only for this CI process, never in the installer.
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { access, mkdir } from "node:fs/promises";
if (process.platform !== "win32")
  throw Error("This smoke check requires Windows.");
const executable =
  process.env.STUDY_ROOM_EXECUTABLE ||
  resolve("src-tauri/target/release/study-room.exe");
let processHandle, browser;
async function launch() {
  processHandle = spawn(executable, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9222",
    },
    stdio: "inherit",
  });
  processHandle.on("error", (error) => {
    throw error;
  });
  const deadline = Date.now() + 45000;
  while (true) {
    try {
      const response = await fetch("http://127.0.0.1:9222/json/version");
      if (response.ok) break;
    } catch {}
    if (Date.now() > deadline)
      throw Error("Study Room did not expose its test WebView2 session.");
    if (processHandle.exitCode !== null)
      throw Error("Study Room exited during startup.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  const page = context.pages()[0] || (await context.waitForEvent("page"));
  await expect(page.getByText("Desktop · saved on this computer")).toBeVisible({
    timeout: 30000,
  });
  return page;
}
async function close(page) {
  const child = processHandle;
  const exited =
    child.exitCode === null
      ? new Promise((resolve) => child.once("exit", resolve))
      : Promise.resolve();
  await page
    .evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("plugin:window|destroy", {
        label: "main",
      }),
    )
    .catch((error) => {
      if (!/closed|Target|disconnected/.test(error.message)) throw error;
    });
  await Promise.race([
    exited,
    new Promise((_, reject) =>
      setTimeout(() => reject(Error("App did not close")), 15000),
    ),
  ]);
  if (browser.isConnected()) await browser.close();
  browser = undefined;
  processHandle = undefined;
}
try {
  let page = await launch();
  await page
    .getByRole("link", { name: "Library", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByLabel("Note title").fill("Windows native smoke check");
  await page
    .locator(".tiptap")
    .fill(
      "This note is saved through the actual Windows Tauri commands to SQLite.",
    );
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await access(
    join(
      process.env.LOCALAPPDATA,
      "com.studyroom.desktop",
      "study-room.sqlite3",
    ),
  );
  await mkdir("release", { recursive: true });
  await page.screenshot({ path: "release/desktop-smoke.png", fullPage: true });
  await close(page);
  page = await launch();
  await page
    .getByRole("link", { name: "Library", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Windows native smoke check", exact: false })
    .click();
  await expect(page.locator(".tiptap")).toContainText(
    "actual Windows Tauri commands",
  );
  const databases = await page.evaluate(() => indexedDB.databases());
  if (databases.length)
    throw Error("Desktop unexpectedly created an IndexedDB database.");
  await page.getByRole("link", { name: "Settings & data" }).click();
  await expect(
    page.getByText("Study tools are installed and work offline", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request persistent storage" }),
  ).toHaveCount(0);
  await close(page);
  console.log(
    "Actual Windows app: launch, native save, reopen, and storage controls passed.",
  );
} finally {
  if (browser?.isConnected()) await browser.close().catch(() => {});
  if (processHandle?.exitCode === null) processHandle.kill();
}
