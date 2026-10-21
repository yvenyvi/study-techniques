// Runs the actual compiled Windows app through WebView2's development CDP port.
// The debugging switch is set only for this CI process, never in the installer.
import { chromium, expect } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { access, mkdir, readdir } from "node:fs/promises";
import { pdf } from "../tests-desktop/pdf.mjs";
import { checkTimerPreferences } from "../tests/timer-preferences-flow.mjs";
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
      STUDY_ROOM_VERIFY_WEBVIEW: "1",
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9222",
      WEBVIEW2_USER_DATA_FOLDER: join(
        process.env.RUNNER_TEMP,
        "StudyRoomWebviewTest",
      ),
    },
    stdio: "inherit",
  });
  processHandle.on("error", (error) => {
    throw error;
  });
  const deadline = Date.now() + 45000;
  let lastConnectionError = "";
  while (true) {
    try {
      const response = await fetch("http://127.0.0.1:9222/json/version");
      if (response.ok) break;
    } catch (error) {
      lastConnectionError = `${error.message}: ${error.cause?.code || ""}`;
    }
    if (Date.now() > deadline) {
      console.error("Debug endpoint:", lastConnectionError);
      console.error(
        execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            "Get-Process study-room,msedgewebview2 -ErrorAction SilentlyContinue | Select-Object Name,Id,MainWindowTitle | ConvertTo-Json -Compress; Get-CimInstance Win32_Process -Filter \"name='msedgewebview2.exe'\" | ForEach-Object { [pscustomobject]@{ Id=$_.ProcessId; HasDebugPort=($_.CommandLine -match 'remote-debugging-port=9222') } } | ConvertTo-Json -Compress",
          ],
          { encoding: "utf8" },
        ),
      );
      console.error(
        "Native database exists:",
        await access(
          join(
            process.env.LOCALAPPDATA,
            "com.studyroom.desktop",
            "study-room.sqlite3",
          ),
        ).then(
          () => true,
          () => false,
        ),
      );
      throw Error("Study Room did not expose its test WebView2 session.");
    }
    if (processHandle.exitCode !== null)
      throw Error("Study Room exited during startup.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  const page = context.pages()[0] || (await context.waitForEvent("page"));
  page.on("pageerror", (error) =>
    console.error("WebView2 page error:", error.message),
  );
  page.on("console", (message) => {
    if (message.type() === "error") console.error("WebView2:", message.text());
  });
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
  await page.locator("input[type=file]").setInputFiles({
    name: "Windows native reading.pdf",
    mimeType: "application/pdf",
    buffer: pdf(),
  });
  await expect(page.locator(".textLayer")).toContainText(
    "Working memory supports learning.",
    { timeout: 15000 },
  );
  await page.getByRole("button", { name: "Create a note" }).click();
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
  const pdfFiles = await readdir(
    join(process.env.LOCALAPPDATA, "com.studyroom.desktop", "pdfs"),
  );
  if (pdfFiles.length !== 1 || !pdfFiles[0].endsWith(".pdf"))
    throw Error("Native PDF file was not saved.");
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
  // Library note links intentionally open the standalone note view. Open the
  // PDF card separately to verify that its file also survived the restart.
  await page
    .getByRole("link", { name: "Library", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Windows native reading", exact: true })
    .click();
  await expect(page.locator(".textLayer")).toContainText(
    "Working memory supports learning.",
    { timeout: 15000 },
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
  await checkTimerPreferences(page);
  await close(page);
  console.log(
    "Actual Windows app: install, PDF import/render, native note save, reopen, storage controls, and timer preferences passed.",
  );
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page && !page.isClosed()) {
    await mkdir("release", { recursive: true });
    await page
      .screenshot({ path: "release/desktop-smoke-failure.png", fullPage: true })
      .catch(() => {});
    console.error(
      "Native page at failure:",
      (
        await page
          .locator("body")
          .innerText()
          .catch(() => "unavailable")
      ).slice(0, 5000),
    );
  }
  throw error;
} finally {
  if (browser?.isConnected()) await browser.close().catch(() => {});
  if (processHandle?.exitCode === null) processHandle.kill();
}
