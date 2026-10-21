import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "./storage/live";
import { db } from "./data";
import { isDesktop, nativeInvoke } from "./platform";
import { flushEditors } from "./shared";
import { backup, restore, download } from "./backup";
import { PageTitle, report } from "./shared";
import { Download, Upload } from "lucide-react";
import { saveFocusPreferences } from "./timer-preferences";
import { GuidePage } from "./guides";
import { resetGuideProgress } from "./guides-progress";
export function Settings({ ready }: { ready: boolean }) {
  const settings = useLiveQuery(() => db.settings.get("preferences"), []);
  const [focus, setFocus] = useState(25);
  const [rest, setRest] = useState(5);
  const [sound, setSound] = useState(false);
  const [estimate, setEstimate] = useState<StorageEstimate>();
  const [storagePath, setStoragePath] = useState("");
  const [persistent, setPersistent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const savedFocus = settings?.value.focus;
  const savedRest = settings?.value.rest;
  const savedSound = settings?.value.sound;
  useEffect(() => {
    if (
      savedFocus !== undefined &&
      savedRest !== undefined &&
      savedSound !== undefined
    ) {
      setFocus(savedFocus);
      setRest(savedRest);
      setSound(savedSound);
    }
  }, [savedFocus, savedRest, savedSound]);
  useEffect(() => {
    if (isDesktop) {
      nativeInvoke<string>("storage_location")
        .then(setStoragePath)
        .catch(report);
      return;
    }
    navigator.storage?.estimate().then(setEstimate);
    navigator.storage?.persisted().then(setPersistent);
  }, []);
  return (
    <>
      <GuidePage id="settings" />
      <PageTitle
        eyebrow="MAKE THIS SPACE YOURS"
        title="Settings & your data"
        description="Your materials stay on this device. Keep a backup somewhere safe."
      />
      <section className="panel">
        <h2>Focus preferences</h2>
        <form
          data-guide="focus-preferences"
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingPreferences(true);
            try {
              await saveFocusPreferences(db, { focus, rest, sound });
              report(
                "Preferences saved. Idle timers updated; sessions in progress keep their remaining time.",
              );
            } catch (error) {
              report(error);
            } finally {
              setSavingPreferences(false);
            }
          }}
        >
          <label>
            Focus minutes
            <input
              type="number"
              min="1"
              max="180"
              required
              value={focus}
              onChange={(e) => setFocus(Number(e.target.value))}
            />
          </label>
          <label>
            Break minutes
            <input
              type="number"
              min="1"
              max="60"
              required
              value={rest}
              onChange={(e) => setRest(Number(e.target.value))}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => setSound(e.target.checked)}
            />
            Completion sound
          </label>
          <button disabled={savingPreferences}>
            {savingPreferences ? "Saving…" : "Save preferences"}
          </button>
        </form>
        <p className="small muted">
          Saved durations apply immediately to timers you haven’t started.
          Running or paused sessions keep their remaining time; the new
          durations apply to the next focus session or break.
        </p>
        {!isDesktop && (
          <button
            className="secondary"
            onClick={async () => {
              if ("Notification" in window)
                report(
                  `Notifications: ${await Notification.requestPermission()}`,
                );
              else report("This browser does not support notifications.");
            }}
          >
            Enable browser notifications
          </button>
        )}
        <p className="small muted">
          {isDesktop
            ? "Keep Study Room open for completion sounds. Your timer resumes from its saved deadline after reopening, but alerts do not run while the app is closed or your computer is asleep."
            : "Background alerts depend on your browser. Timer progress is saved even when alerts are unavailable."}
        </p>
      </section>
      <section className="panel" data-guide="offline-storage">
        <h2>Offline & storage</h2>
        {isDesktop ? (
          <>
            <p>
              ✓ Study tools are installed and work offline from the first
              launch.
            </p>
            <p>
              Notes, reviewers, goals, and history are saved in a local SQLite
              database. PDFs are kept as files in this app’s data folder.
            </p>
            <p className="small">
              Library folder:{" "}
              <code style={{ overflowWrap: "anywhere" }}>
                {storagePath || "Loading…"}
              </code>
            </p>
            <p className="small muted">
              Clearing your browser’s data will not affect this library. Keep
              ZIP backups on another drive or in a safe folder. Deleting this
              app’s data folder or losing the computer can still remove your
              work.
            </p>
          </>
        ) : (
          <>
            <p>
              {ready
                ? "✓ Application cached for offline use."
                : "Open the production app online once to prepare offline assets."}
            </p>
            <p>
              {persistent
                ? "Persistent storage enabled."
                : "Storage may be cleared by your browser."}
            </p>
            <p>
              {estimate
                ? `${((estimate.usage || 0) / 1024 / 1024).toFixed(1)} MB used of approximately ${((estimate.quota || 0) / 1024 / 1024).toFixed(0)} MB available.`
                : "Storage estimate unavailable."}
            </p>
            <button
              className="secondary"
              onClick={async () => {
                const ok = await navigator.storage?.persist();
                setPersistent(!!ok);
                report(
                  ok
                    ? "Persistent storage enabled."
                    : "Your browser did not grant persistent storage. Export backups regularly.",
                );
              }}
            >
              Request persistent storage
            </button>
            <p className="small muted">
              Clearing site data or using private browsing can remove your work.
              Installation is available from your browser’s app/menu controls
              when supported.
            </p>
          </>
        )}
      </section>
      <section className="panel" data-guide="backup-tools">
        <h2>Backup & restore</h2>
        <p>
          Export PDFs, notes, reviewers, goals, and history as a ZIP. Restore
          requires a completely empty workspace. Web, desktop, and iPad backups
          use the same format. They transfer manually and do not sync
          automatically.
        </p>
        <div className="actions">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (!(await flushEditors()))
                  throw Error("Save your edits before exporting a backup.");
                await download(
                  await backup(),
                  `study-room-${new Date().toISOString().slice(0, 10)}.zip`,
                );
              } catch (e) {
                report(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={16} />
            Export backup
          </button>
          <label className="button secondary">
            <Upload size={16} />
            Restore ZIP
            <input
              hidden
              disabled={busy}
              type="file"
              accept=".zip"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  await restore(file);
                  report("Backup restored.");
                } catch (err) {
                  report(err);
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>
      </section>
      <section className="panel" data-guide="guide-settings">
        <h2>Page guides</h2>
        <p>
          Each page has a short introduction with optional things to try. Use
          Page guide at the top to replay the current page’s guide anytime.
        </p>
        <button
          className="secondary"
          onClick={() => {
            resetGuideProgress();
            report(
              "Page guides reset. They’ll appear when you next open each page. Your study work is unchanged.",
            );
          }}
        >
          Show all guides again
        </button>
      </section>
    </>
  );
}
