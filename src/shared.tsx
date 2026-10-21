import { useState, useRef, useEffect } from "react";
import { Link, useBlocker } from "react-router-dom";
import { useLiveQuery } from "./storage/live";
import { db, type Ref } from "./data";
const activeFlushers = new Set<() => Promise<boolean>>();
export async function flushEditors() {
  return (await Promise.all([...activeFlushers].map((fn) => fn()))).every(
    Boolean,
  );
}
export function report(e: unknown) {
  window.dispatchEvent(
    new CustomEvent("notice", {
      detail: e instanceof Error ? e.message : String(e),
    }),
  );
}
export function CourseSelect({
  value,
  onChange,
  filter = false,
}: {
  value: string;
  onChange: (v: string) => void;
  filter?: boolean;
}) {
  const courses = useLiveQuery(() => db.courses.toArray(), []) || [];
  return (
    <select
      aria-label="Course"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{filter ? "All courses" : "Unfiled"}</option>
      {courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
export function Source({ source }: { source: Ref }) {
  const doc = useLiveQuery(
    () => db.documents.get(source.documentId),
    [source.documentId],
  );
  return doc ? (
    <Link className="source" to={`/study/${doc.id}?page=${source.page}`}>
      {doc.title} · p. {source.page} ↗
    </Link>
  ) : (
    <span className="source">Source unavailable · p. {source.page}</span>
  );
}

export function useRecordDraft<T extends { id: string }>(
  record: T | undefined,
  table: "notes" | "reviewers",
) {
  const [draft, setDraft] = useState<T | undefined>();
  const [status, setStatus] = useState("Saved");
  const pending = useRef<T | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lock = useRef(false);
  const saving = useRef<Promise<any>>(Promise.resolve());
  const removing = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [blocked, setBlocked] = useState(!!navigator.locks);
  const flush = async () => {
    clearTimeout(timer.current);
    if (removing.current) return !pending.current;
    const value = pending.current;
    if (!value) return true;
    setStatus("Saving…");
    try {
      await (saving.current = saving.current
        .catch(() => {})
        .then(async () => {
          const updated = await db.table(table).update(value.id, value);
          if (!updated) throw Error("This item has been deleted.");
        }));
      if (pending.current === value) {
        pending.current = undefined;
        setStatus("Saved");
      }
    } catch {
      setStatus("Save failed — edits are still here. Retry.");
    }
    return !pending.current;
  };
  useEffect(() => {
    if (record && !draft) setDraft(record);
  }, [record, draft]);
  useEffect(() => {
    if (!record) return;
    let release: () => void = () => {};
    let cancelled = false;
    if (navigator.locks)
      navigator.locks.request(
        `edit-${table}-${record.id}`,
        { ifAvailable: true },
        async (l) => {
          if (cancelled) return;
          if (!l) {
            setBlocked(true);
            return;
          }
          lock.current = true;
          setBlocked(false);
          await new Promise<void>((r) => (release = r));
        },
      );
    activeFlushers.add(flush);
    const f = () => {
      void flush();
    };
    window.addEventListener("flush-editors", f);
    const leave = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      cancelled = true;
      activeFlushers.delete(flush);
      lock.current = false;
      void flush().finally(release);
      window.removeEventListener("flush-editors", f);
      window.removeEventListener("beforeunload", leave);
    };
  }, [record?.id]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !!pending.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void flush().then(() => {
      if (!pending.current) blocker.proceed?.();
      else {
        blocker.reset?.();
        report("Your edits could not be saved. Please retry before leaving.");
      }
    });
  }, [blocker.state]);
  function change(next: T) {
    if (blocked || removing.current) return;
    setDraft(next);
    pending.current = next;
    setStatus("Unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 450);
  }
  async function remove() {
    if (blocked || !record)
      throw Error("This item cannot be deleted from this tab.");
    if (removing.current) return;
    removing.current = true;
    setDeleting(true);
    clearTimeout(timer.current);
    try {
      // Finish any write already in flight, then discard the draft only after
      // deletion succeeds. Cleanup and queued autosaves cannot recreate it.
      await saving.current.catch(() => {});
      await db.table(table).delete(record.id);
      pending.current = undefined;
      setStatus("Deleted");
    } catch (error) {
      removing.current = false;
      setDeleting(false);
      throw error;
    }
  }
  return {
    draft,
    change,
    status,
    flush,
    blocked: blocked || deleting,
    deleting,
    remove,
  };
}

export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </div>
  );
}
