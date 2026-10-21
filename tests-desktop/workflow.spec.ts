import { test, expect } from "@playwright/test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { openBridge } from "./bridge";
function pdf() {
  const stream =
    "BT /F1 18 Tf 50 720 Td (Working memory supports learning.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(result));
    result += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}
test("desktop UI uses real native storage, survives browser-data removal, and exports a transferable ZIP", async ({
  page,
  context,
}) => {
  const folder = await mkdtemp(join(tmpdir(), "study-desktop-ui-"));
  let bridge = openBridge(folder);
  const backupPath = join(folder, "export.zip");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.exposeBinding("nativeTestInvoke", (_source, command, args) =>
    bridge.invoke(command, args),
  );
  await context.addInitScript(
    ({ backupPath }) => {
      const w = window as any;
      let sequence = 0;
      w.nativeCallbacks = {};
      w.nativeListeners = {};
      w.__TAURI_INTERNALS__ = {
        metadata: {
          currentWindow: { label: "main" },
          currentWebview: { label: "main" },
        },
        transformCallback: (fn: any) => {
          const id = ++sequence;
          w.nativeCallbacks[id] = fn;
          return id;
        },
        invoke: async (command: string, args: any) => {
          if (command === "plugin:event|listen") {
            w.nativeListeners[args.event] = args.handler;
            return ++sequence;
          }
          if (command === "plugin:event|unlisten") return;
          if (command === "plugin:window|destroy") {
            w.nativeClosed = true;
            return;
          }
          if (command === "plugin:dialog|save") return backupPath;
          if (command === "commit_library" && w.failWrites)
            throw Error("Simulated unavailable disk");
          return w.nativeTestInvoke(command, args);
        },
      };
      IDBFactory.prototype.open = () => {
        throw Error("Desktop must not open IndexedDB");
      };
    },
    { backupPath },
  );
  try {
    await page.goto("/app.html");
    await expect(
      page.getByText("Desktop · saved on this computer"),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Library", exact: true })
      .first()
      .click();
    await page
      .locator("input[type=file]")
      .setInputFiles({
        name: "Memory.pdf",
        mimeType: "application/pdf",
        buffer: pdf(),
      });
    await expect(page.locator(".textLayer")).toContainText("Working memory");
    await page.getByRole("button", { name: "Create a note" }).click();
    await page
      .locator(".tiptap")
      .fill("My desktop reviewer starts with clear notes.");
    await expect(
      page.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible();
    const workspace = page.url();
    // Restart the actual storage process and clear all browser storage. Native
    // SQLite and PDF files must remain the only source of the student's library.
    await bridge.close();
    bridge = openBridge(folder);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Storage.clearDataForOrigin", {
      origin: "http://127.0.0.1:4175",
      storageTypes: "all",
    });
    await page.reload();
    await expect(page.locator(".tiptap")).toContainText("My desktop reviewer");
    await expect(page.locator(".textLayer")).toContainText("Working memory");
    await page.getByRole("link", { name: "Settings & data" }).click();
    await expect(
      page.getByText("Study tools are installed and work offline", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Request persistent storage" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Export backup" }).click();
    await expect
      .poll(async () => {
        try {
          return (await readFile(backupPath)).length;
        } catch {
          return 0;
        }
      })
      .toBeGreaterThan(0);
    const files = unzipSync(await readFile(backupPath));
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));
    expect(manifest.version).toBe(1);
    expect(manifest.notes[0].title).toContain("Memory");
    expect(files[`pdfs/${manifest.documents[0].id}.pdf`]).toBeDefined();
    expect(manifest.documents[0].pdfKey).toBeUndefined();
    await page.goto(workspace);
    // Closing must flush a pending edit. A failed save must keep the window open.
    await page.evaluate(() => {
      (window as any).failWrites = true;
    });
    await page
      .locator(".tiptap")
      .fill("Keep my unsaved edit when the disk fails.");
    await expect(
      page.getByRole("button", { name: "Save failed", exact: false }),
    ).toBeVisible();
    await page.evaluate(async () => {
      const w = window as any;
      await w.nativeCallbacks[w.nativeListeners["tauri://close-requested"]]({
        event: "tauri://close-requested",
        id: 1,
        payload: null,
      });
    });
    await expect(page.getByRole("status")).toContainText(
      "Your edits could not be saved. Retry saving before closing Study Room.",
    );
    expect(
      await page.evaluate(() => (window as any).nativeClosed),
    ).toBeUndefined();
    await page.evaluate(async () => {
      const w = window as any;
      w.failWrites = false;
      await w.nativeCallbacks[w.nativeListeners["tauri://close-requested"]]({
        event: "tauri://close-requested",
        id: 1,
        payload: null,
      });
    });
    expect(await page.evaluate(() => (window as any).nativeClosed)).toBe(true);
    const rows = await bridge.invoke<any[]>("load_library");
    expect(JSON.stringify(rows.find((r) => r.table === "notes"))).toContain(
      "Keep my unsaved edit",
    );
    expect(errors).toEqual([]);
  } finally {
    await bridge.close();
    await rm(folder, { recursive: true, force: true });
  }
});
