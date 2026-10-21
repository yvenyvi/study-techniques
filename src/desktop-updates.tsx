import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { db } from "./data";
import { isDesktop, nativeInvoke } from "./platform";
import { flushEditors, report } from "./shared";
import { DesktopStore } from "./storage/desktop";

type Phase =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "installing"
  | "error";
type State = {
  version: string;
  enabled: boolean;
  phase: Phase;
  available?: string;
  progress?: number;
  error?: string;
};
type Updates = State & {
  check: () => Promise<void>;
  install: () => Promise<void>;
  busy: boolean;
};
const UpdatesContext = createContext<Updates | null>(null);
export const useDesktopUpdates = () => useContext(UpdatesContext);

async function saveBeforeUpdate() {
  if ((await db.timers.get("active"))?.started)
    throw Error(
      "End your active focus session or break before installing the update.",
    );
  if (!(await flushEditors()))
    throw Error("Your edits could not be saved. Save them before updating.");
  if (db instanceof DesktopStore) await db.settle();
}

export function DesktopUpdatesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    version: "",
    enabled: false,
    phase: "idle",
  });
  const update = useRef<Update | null>(null);
  const progressDialog = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const enabled = useRef(false);
  const alive = useRef(true);
  const patch = (next: Partial<State>) => {
    if (alive.current) setState((previous) => ({ ...previous, ...next }));
  };
  const check = useCallback(async () => {
    if (!enabled.current || locked.current) return;
    locked.current = true;
    patch({ phase: "checking", error: undefined });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const result = await check({ timeout: 15000 });
      if (!alive.current) {
        await result?.close();
        return;
      }
      await update.current?.close().catch(() => {});
      update.current = result;
      patch({
        phase: result ? "available" : "current",
        available: result?.version,
      });
    } catch {
      patch({
        phase: update.current ? "available" : "error",
        error:
          "Couldn’t check for updates. Check your internet connection and try again. Your library still works offline.",
      });
    } finally {
      locked.current = false;
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    if (!isDesktop) return;
    nativeInvoke<{ version: string; enabled: boolean }>("desktop_update_status")
      .then((info) => {
        if (!alive.current) return;
        enabled.current = info.enabled;
        patch(info);
        if (info.enabled) void check();
      })
      .catch(() =>
        patch({
          error: "Update information is unavailable in this build.",
          phase: "error",
        }),
      );
    const interval = setInterval(() => void check(), 6 * 60 * 60 * 1000);
    const online = () => void check();
    window.addEventListener("online", online);
    return () => {
      alive.current = false;
      clearInterval(interval);
      window.removeEventListener("online", online);
      void update.current?.close().catch(() => {});
    };
  }, [check]);
  const install = async () => {
    const selected = update.current;
    if (!selected || locked.current) return;
    locked.current = true;
    try {
      await saveBeforeUpdate();
      patch({ phase: "downloading", error: undefined, progress: undefined });
      let downloaded = 0,
        total = 0;
      await selected.download(
        (event) => {
          if (event.event === "Started") total = event.data.contentLength || 0;
          if (event.event === "Progress") {
            downloaded += event.data.chunkLength;
            patch({
              progress: total
                ? Math.min(100, Math.floor((downloaded / total) * 100))
                : undefined,
            });
          }
        },
        { timeout: 120000 },
      );
      // Recheck after the download so queued writes and timer changes cannot be lost.
      await saveBeforeUpdate();
      patch({ phase: "installing", progress: 100 });
      // Tauri verifies the package signature before starting NSIS. Windows exits
      // this process and the passive installer restarts the updated application.
      await selected.install({ restartAfterInstall: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      patch({
        phase: "available",
        error: `Update not installed: ${message}. Your library has been kept.`,
      });
      report(`Update not installed: ${message}`);
    } finally {
      locked.current = false;
    }
  };
  const busy = state.phase === "downloading" || state.phase === "installing";
  useEffect(() => {
    if (busy) progressDialog.current?.focus();
  }, [busy]);
  return (
    <UpdatesContext.Provider value={{ ...state, check, install, busy }}>
      <div inert={busy}>{children}</div>
      {busy && (
        <div
          className="desktop-update-overlay"
          ref={progressDialog}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-update-heading"
        >
          <section className="panel" aria-live="polite">
            <h2 id="desktop-update-heading">
              {state.phase === "installing"
                ? "Installing update…"
                : "Downloading update…"}
            </h2>
            <p>
              {state.phase === "installing"
                ? "Study Room will close and restart. Your saved library stays on this computer."
                : "Your work is saved. Keep Study Room open while the update downloads."}
            </p>
            <progress
              max={100}
              value={state.progress}
              aria-label="Update download"
            />
            {state.progress !== undefined && <p>{state.progress}%</p>}
          </section>
        </div>
      )}
    </UpdatesContext.Provider>
  );
}

export function DesktopUpdateBanner() {
  const updates = useDesktopUpdates();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [updates?.available]);
  if (!isDesktop || !updates?.available || dismissed) return null;
  return (
    <div className="banner desktop-update-banner" role="status">
      <div>
        <strong>Study Room {updates.available} is available.</strong>
        <p>Install when you’re ready. Your saved library will be kept.</p>
      </div>
      <button
        disabled={updates.busy || updates.phase === "checking"}
        onClick={() => void updates.install()}
      >
        Install and restart
      </button>
      <button
        className="secondary"
        disabled={updates.busy}
        onClick={() => setDismissed(true)}
      >
        Later
      </button>
    </div>
  );
}

export function DesktopUpdateSettings() {
  const updates = useDesktopUpdates();
  if (!isDesktop || !updates) return null;
  return (
    <section className="panel">
      <h2>App updates</h2>
      {updates.version && <p>Study Room {updates.version} for Windows</p>}
      <p>
        Checks for updates when you open the app and every six hours while it’s
        online. You choose when to install and restart.
      </p>
      {!updates.enabled && (
        <p>
          This build doesn’t have automatic updates configured. Install a signed
          Windows release to enable them.
        </p>
      )}
      <div aria-live="polite">
        {updates.phase === "checking" && <p>Checking for updates…</p>}
        {updates.phase === "current" && <p>You’re up to date.</p>}
        {updates.available && (
          <p>Version {updates.available} is ready to download.</p>
        )}
        {updates.error && <p role="alert">{updates.error}</p>}
      </div>
      <div className="actions wrap">
        <button
          className="secondary"
          disabled={
            !updates.enabled || updates.busy || updates.phase === "checking"
          }
          onClick={() => void updates.check()}
        >
          Check for updates
        </button>
        {updates.available && (
          <button
            disabled={updates.busy || updates.phase === "checking"}
            onClick={() => void updates.install()}
          >
            Install and restart
          </button>
        )}
      </div>
      <p className="small muted">
        Export a ZIP backup before updating. End your active session first; the
        app saves pending edits before installing.
      </p>
    </section>
  );
}
