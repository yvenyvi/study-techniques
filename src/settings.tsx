import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./data";
import { backup, restore, download } from "./backup";
import { PageTitle, report } from "./shared";
import { Download, Upload } from "lucide-react";
export function Settings({ ready }: { ready: boolean }) {
  const settings = useLiveQuery(() => db.settings.get("preferences"), []);
  const [focus, setFocus] = useState(25);
  const [rest, setRest] = useState(5);
  const [sound, setSound] = useState(false);
  const [estimate, setEstimate] = useState<StorageEstimate>();
  const [persistent, setPersistent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings) {
      setFocus(settings.value.focus);
      setRest(settings.value.rest);
      setSound(settings.value.sound);
    }
    navigator.storage?.estimate().then(setEstimate);
    navigator.storage?.persisted().then(setPersistent);
  }, [settings]);
  return (
    <>
      <PageTitle
        eyebrow="MAKE THIS SPACE YOURS"
        title="Settings & your data"
        description="Your materials stay on this device. Keep a backup somewhere safe."
      />
      <section className="panel">
        <h2>Focus preferences</h2>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await db.settings.put({
              id: "preferences",
              value: { focus, rest, sound },
            });
            report("Preferences saved.");
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
          <button>Save preferences</button>
        </form>
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
        <p className="small muted">
          Background alerts depend on your browser. Timer progress is saved even
          when alerts are unavailable.
        </p>
      </section>
      <section className="panel">
        <h2>Offline & storage</h2>
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
          Installation is available from your browser’s app/menu controls when
          supported.
        </p>
      </section>
      <section className="panel">
        <h2>Backup & restore</h2>
        <p>
          Export PDFs, notes, reviewers, goals, and history as a ZIP. Restore
          requires a completely empty workspace.
        </p>
        <div className="actions">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                download(
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
    </>
  );
}
