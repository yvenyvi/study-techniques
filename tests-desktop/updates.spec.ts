import { test, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBridge } from "./bridge";
import { disableGuidesForContext } from "../tests/guides-flow.mjs";

// Real SQLite storage plus the official JS updater API. Only the Windows
// updater IPC is simulated; an installer cannot run in a Linux browser.
test.beforeEach(async ({ context }) => {
  await disableGuidesForContext(context);
});

async function setup(
  context: any,
  options: {
    enabled?: boolean;
    current?: boolean;
    offline?: boolean;
    badSignature?: boolean;
  } = {},
) {
  const folder = await mkdtemp(join(tmpdir(), "study-updates-"));
  const bridge = openBridge(folder);
  await context.exposeBinding(
    "nativeTestInvoke",
    (_source: any, command: string, args: any) => bridge.invoke(command, args),
  );
  await context.addInitScript((options: any) => {
    const w = window as any;
    let sequence = 0;
    w.updateCalls = [];
    w.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      transformCallback: () => ++sequence,
      invoke: async (command: string, args: any) => {
        if (command === "plugin:event|listen") return ++sequence;
        if (
          command === "plugin:event|unlisten" ||
          command === "plugin:resources|close"
        )
          return;
        if (command === "desktop_update_status")
          return { enabled: options.enabled !== false, version: "1.4.0" };
        if (command.startsWith("plugin:updater|")) w.updateCalls.push(command);
        if (command === "plugin:updater|check") {
          if (options.offline || w.failCheck)
            throw Error("Network unavailable");
          return options.current
            ? null
            : {
                rid: 50,
                currentVersion: "1.4.0",
                version: "1.4.1",
                body: "Study improvements",
                rawJson: {},
              };
        }
        if (command === "plugin:updater|download") {
          if (options.badSignature && !w.allowDownload)
            throw Error("Signature verification failed");
          args.onEvent.onmessage({
            event: "Started",
            data: { contentLength: 100 },
          });
          args.onEvent.onmessage({
            event: "Progress",
            data: { chunkLength: 100 },
          });
          args.onEvent.onmessage({ event: "Finished" });
          return 51;
        }
        if (command === "plugin:updater|install") {
          w.installed = args;
          return;
        }
        if (command === "commit_library" && w.failWrites)
          throw Error("Simulated disk full");
        return w.nativeTestInvoke(command, args);
      },
    };
  }, options);
  return {
    close: async () => {
      await bridge.close();
      await rm(folder, { recursive: true, force: true });
    },
  };
}

test("automatic check offers an update; active sessions block installation and retry preserves saved history", async ({
  page,
  context,
}) => {
  const storage = await setup(context);
  try {
    await page.goto("/app.html");
    await expect(
      page.getByText("Study Room 1.4.1 is available."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Start timer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Install and restart", exact: true })
      .click();
    await expect(
      page
        .getByText(/Update not installed: End your active focus session/)
        .first(),
    ).toBeVisible();
    expect(
      await page.evaluate(() => (window as any).updateCalls),
    ).not.toContain("plugin:updater|download");
    await page.getByRole("button", { name: "Expand focus timer" }).click();
    await page
      .getByRole("button", { name: "End session", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save session & prepare break" })
      .click();
    await page
      .getByRole("button", { name: "Install and restart", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => (window as any).installed))
      .toMatchObject({
        restartAfterInstall: true,
        updateRid: 50,
        bytesRid: 51,
      });
    await page.reload();
    await page.getByRole("link", { name: "Goals & history" }).click();
    await expect(
      page.getByText("Independent focus session", { exact: true }),
    ).toBeVisible();
  } finally {
    await storage.close();
  }
});

test("signature errors never launch the installer and the saved library stays usable", async ({
  page,
  context,
}) => {
  const storage = await setup(context, { badSignature: true });
  try {
    await page.goto("/app.html");
    await page
      .getByRole("button", { name: "Install and restart", exact: true })
      .click();
    await expect(
      page
        .getByText(/Update not installed: Signature verification failed/)
        .first(),
    ).toBeVisible();
    expect(
      await page.evaluate(() => (window as any).updateCalls),
    ).not.toContain("plugin:updater|install");
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "New course" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Settings & data" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Your library has been kept." }),
    ).toBeVisible();
    await page.evaluate(() => {
      (window as any).allowDownload = true;
    });
    await page
      .getByRole("button", { name: "Install and restart", exact: true })
      .last()
      .click();
    await expect
      .poll(() => page.evaluate(() => (window as any).installed))
      .toMatchObject({ restartAfterInstall: true });
  } finally {
    await storage.close();
  }
});

test("offline checks do not stop the app, and manual checks can be retried", async ({
  page,
  context,
}) => {
  const storage = await setup(context, { offline: true });
  try {
    await page.goto("/app.html");
    await page.getByRole("link", { name: "Settings & data" }).click();
    await expect(
      page.getByText(/Your library still works offline/),
    ).toBeVisible();
    await expect(page.getByText("Study Room 1.4.0 for Windows")).toBeVisible();
    await page.getByRole("button", { name: "Check for updates" }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).updateCalls.length))
      .toBe(2);
  } finally {
    await storage.close();
  }
});

test("an up-to-date build does not offer an installer", async ({
  page,
  context,
}) => {
  const storage = await setup(context, { current: true });
  try {
    await page.goto("/app.html");
    await page.getByRole("link", { name: "Settings & data" }).click();
    await expect(page.getByText("You’re up to date.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Install and restart" }),
    ).toHaveCount(0);
  } finally {
    await storage.close();
  }
});

test("development builds without a signing identity clearly disable update checks", async ({
  page,
  context,
}) => {
  const storage = await setup(context, { enabled: false });
  try {
    await page.goto("/app.html");
    await page.getByRole("link", { name: "Settings & data" }).click();
    await expect(
      page.getByText(/This build doesn’t have automatic updates configured/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Check for updates" }),
    ).toBeDisabled();
    expect(await page.evaluate(() => (window as any).updateCalls)).toEqual([]);
  } finally {
    await storage.close();
  }
});

test("unsaved edits prevent downloading or installing an update", async ({
  page,
  context,
}) => {
  const storage = await setup(context);
  try {
    await page.goto("/app.html");
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "New note", exact: true }).click();
    await expect(page.locator(".tiptap")).toBeVisible();
    await page.evaluate(() => {
      (window as any).failWrites = true;
    });
    await page.locator(".tiptap").fill("Keep these unsaved study notes.");
    await page
      .getByRole("button", { name: "Install and restart", exact: true })
      .click();
    await expect(
      page
        .getByText(/Update not installed: Your edits could not be saved/)
        .first(),
    ).toBeVisible();
    expect(
      await page.evaluate(() => (window as any).updateCalls),
    ).not.toContain("plugin:updater|download");
    await expect(page.locator(".tiptap")).toContainText(
      "Keep these unsaved study notes.",
    );
  } finally {
    await storage.close();
  }
});
