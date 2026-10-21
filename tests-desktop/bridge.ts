import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import type { Bridge } from "../src/storage/desktop";
export function openBridge(folder: string) {
  const child = spawn(
    resolve(
      `src-tauri/target/debug/examples/storage_bridge${process.platform === "win32" ? ".exe" : ""}`,
    ),
    [folder],
    { stdio: ["pipe", "pipe", "inherit"] },
  );
  let sequence = 0;
  const pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request?.reject(Error(message.error));
    else request?.resolve(message.result);
  });
  const fail = (error: Error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  child.on("error", fail);
  child.on("exit", () => fail(Error("Native test storage process exited.")));
  const invoke: Bridge = (command, args = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ id, command, args }) + "\n");
    });
  return {
    invoke,
    close: async () => {
      if (child.exitCode !== null) return;
      const exited = new Promise<void>((resolve) =>
        child.once("exit", () => resolve()),
      );
      child.stdin.end();
      await exited;
    },
  };
}
