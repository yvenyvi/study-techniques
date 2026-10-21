import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useLiveQuery } from "./storage/live";
import { TextLayer, type PDFDocumentProxy } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Minus,
  BookOpen,
  FileText,
} from "lucide-react";
import {
  db,
  uid,
  textOf,
  section,
  removeDocument,
  type Note,
  type Ref,
} from "./data";
import { DeleteButton } from "./delete";
import { getDocument } from "./pdf";
import { CourseSelect, report, useRecordDraft, flushEditors } from "./shared";
import { RichEditor } from "./editor";
export function Workspace() {
  const { id } = useParams();
  return <WorkspaceInner key={id} id={id!} />;
}
function WorkspaceInner({ id }: { id: string }) {
  const standalone = id.startsWith("note-");
  const doc = useLiveQuery(
    () => (standalone ? undefined : db.documents.get(id)),
    [id],
  );
  const notes = useLiveQuery(
    () =>
      standalone
        ? db.notes.where("id").equals(id.slice(5)).toArray()
        : db.notes.where("documentId").equals(id).toArray(),
    [id],
  );
  const [noteId, setNoteId] = useState("");
  const [noteActions, setNoteActions] = useState<HTMLDivElement | null>(null);
  const [tab, setTab] = useState("pdf");
  const [ratio, setRatio] = useState(52);
  const [addition, setAddition] = useState<Ref>();
  const [selectedText, setSelectedText] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewRefs, setReviewRefs] = useState<Ref[]>([]);
  const [target, setTarget] = useState("");
  const reviewers = useLiveQuery(() => db.reviewers.toArray(), []) || [];
  const [params] = useSearchParams();
  const pageRequest = Number(params.get("page"));
  const navigate = useNavigate();
  async function newNote() {
    if (!(await flushEditors()))
      return report("Save your edits before opening another note.");
    const n: Note = {
      id: uid(),
      title: doc ? `${doc.title} — notes` : "Untitled note",
      courseId: doc?.courseId || "",
      documentId: standalone ? undefined : id,
      content: { type: "doc", content: [{ type: "paragraph" }] },
      updated: Date.now(),
    };
    await db.notes.add(n);
    if (standalone) navigate(`/study/note-${n.id}`);
    setNoteId(n.id);
    setTab("notes");
  }
  const note = notes?.find((n) => n.id === noteId) || notes?.[0];
  return (
    <>
      <div className="workspace-heading">
        <div>
          <Link className="source" to="/library">
            ← Library
          </Link>
          <h1>
            {standalone
              ? note?.title || "Notes"
              : doc?.title || "Document unavailable"}
          </h1>
        </div>
        <div className="actions workspace-actions">
          {doc && (
            <DeleteButton
              kind="PDF"
              title={doc.title}
              onDelete={async () => {
                if (!(await flushEditors()))
                  throw Error(
                    "Save your notes before deleting this PDF. Your edits are still here.",
                  );
                await removeDocument(doc.id);
                navigate("/library");
              }}
            />
          )}
          <div ref={setNoteActions} className="workspace-note-actions" />
        </div>
      </div>
      <div className="mobile-tabs">
        <button
          className={tab === "pdf" ? "active" : ""}
          onClick={() => setTab("pdf")}
        >
          Reading
        </button>
        <button
          className={tab === "notes" ? "active" : ""}
          onClick={() => setTab("notes")}
        >
          Notes
        </button>
      </div>
      {!standalone && (
        <label className="split-control">
          Reading / notes width
          <input
            type="range"
            min="30"
            max="70"
            value={ratio}
            onChange={(e) => setRatio(Number(e.target.value))}
          />
        </label>
      )}
      <div
        className={`study-split ${standalone ? "standalone" : ""}`}
        style={{
          gridTemplateColumns: standalone ? "1fr" : `${ratio}% minmax(0,1fr)`,
        }}
      >
        {!standalone && (
          <section
            className={`reader-panel ${tab === "pdf" ? "mobile-visible" : ""}`}
          >
            {doc ? (
              <PDFReader
                doc={doc}
                requestedPage={pageRequest}
                onExcerpt={(ref) => {
                  setAddition(ref);
                  setTab("notes");
                }}
              />
            ) : (
              <div className="empty">
                <FileText />
                <h2>Source unavailable</h2>
                <p>
                  The PDF may have been deleted. Your saved notes remain
                  available.
                </p>
              </div>
            )}
          </section>
        )}
        <section
          className={`notes-panel ${tab === "notes" || standalone ? "mobile-visible" : ""}`}
        >
          <div className="notes-heading">
            <BookOpen size={18} />
            <strong>Your notes</strong>
            <button className="text-button" onClick={newNote}>
              <Plus size={16} />
              New
            </button>
          </div>
          {notes && notes.length > 0 && (
            <select
              aria-label="Choose note"
              value={note?.id || ""}
              onChange={async (e) => {
                const next = e.target.value;
                if (!(await flushEditors()))
                  return report("Save your edits before switching notes.");
                setAddition(undefined);
                setNoteId(next);
              }}
            >
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          )}
          {addition && (
            <div className="excerpt-preview">
              <p className="eyebrow">SELECTED FROM PAGE {addition.page}</p>
              <blockquote>{addition.quote}</blockquote>
              <button
                disabled={!note}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("insert-excerpt", { detail: addition }),
                  )
                }
              >
                Insert excerpt into note
              </button>
              <button
                className="text-button"
                onClick={() => setAddition(undefined)}
              >
                Dismiss
              </button>
              {!note && <p>Create a note first.</p>}
            </div>
          )}
          {note ? (
            <NoteEditor
              key={note.id}
              note={note}
              actionsHost={noteActions}
              onDeleted={() => {
                setAddition(undefined);
                if (standalone) navigate("/library");
              }}
              onAdded={() => setAddition(undefined)}
              onReviewer={(text, refs) => {
                setReviewRefs(refs);
                setReviewText(text);
                setSelectedText(text);
              }}
            />
          ) : (
            <div className="empty">
              <BookOpen size={30} />
              <h2>Make sense of what you read</h2>
              <p>Capture an idea, ask a question, or explain a concept.</p>
              <button onClick={newNote}>
                <Plus size={16} />
                Create a note
              </button>
            </div>
          )}
        </section>
      </div>
      {selectedText && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add to reviewer"
          >
            <h2>Add to a reviewer</h2>
            <p className="muted">
              This copies your selection. Future edits stay independent.
            </p>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
            <label>
              Reviewer
              <select
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
              >
                <option value="">Choose reviewer</option>
                {reviewers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Destination field
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">New notes section</option>
                {reviewers
                  .find((r) => r.id === reviewerId)
                  ?.sections.flatMap((s) =>
                    Object.keys(s.fields).map((field) => (
                      <option
                        key={`${s.id}:${field}`}
                        value={`${s.id}:${field}`}
                      >
                        {s.kind} — {field}
                      </option>
                    )),
                  )}
              </select>
            </label>
            <div className="actions">
              <button
                disabled={!reviewerId}
                onClick={async () => {
                  await navigator.locks.request(
                    `edit-reviewers-${reviewerId}`,
                    { ifAvailable: true },
                    async (lock) => {
                      if (!lock)
                        return report(
                          "That reviewer is being edited in another tab.",
                        );
                      const r = await db.reviewers.get(reviewerId);
                      if (r) {
                        const s = section("Free notes");
                        s.fields.Notes = reviewText;
                        s.refs = reviewRefs;
                        const [sectionId, field] = target.split(":");
                        const existing = r.sections.find(
                          (x) => x.id === sectionId && field in x.fields,
                        );
                        const sections = existing
                          ? r.sections.map((x) =>
                              x.id === sectionId
                                ? {
                                    ...x,
                                    fields: {
                                      ...x.fields,
                                      [field]: [x.fields[field], reviewText]
                                        .filter(Boolean)
                                        .join("\n\n"),
                                    },
                                    refs: [...x.refs, ...reviewRefs],
                                  }
                                : x,
                            )
                          : [...r.sections, s];
                        await db.reviewers.update(r.id, {
                          sections,
                          updated: Date.now(),
                        });
                        setSelectedText("");
                        report("Added to reviewer.");
                      }
                    },
                  );
                }}
              >
                Copy to reviewer
              </button>
              <button className="secondary" onClick={() => setSelectedText("")}>
                Cancel
              </button>
            </div>
            <Link to="/reviewers">Create a reviewer first ↗</Link>
          </section>
        </div>
      )}
    </>
  );
}
function NoteEditor({
  note,
  actionsHost,
  onDeleted,
  onAdded,
  onReviewer,
}: {
  note: Note;
  actionsHost: HTMLDivElement | null;
  onDeleted: () => void;
  onAdded: () => void;
  onReviewer: (text: string, refs: Ref[]) => void;
}) {
  const {
    draft: n,
    change,
    status,
    flush,
    blocked,
    deleting,
    remove,
  } = useRecordDraft(note, "notes");
  const [revision, setRevision] = useState(0);
  const current = useRef(n);
  current.current = n;
  const changeRef = useRef(change);
  changeRef.current = change;
  useEffect(() => {
    const fn = async (e: Event) => {
      const ref = (e as CustomEvent<Ref>).detail;
      const source = await db.documents.get(ref.documentId);
      const v = current.current;
      if (!v || blocked) return;
      const content = {
        ...v.content,
        content: [
          ...(v.content.content || []),
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: ref.quote }],
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `${source?.title || "Source unavailable"} · page ${ref.page}`,
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: `/study/${ref.documentId}?page=${ref.page}`,
                    },
                  },
                ],
              },
            ],
          },
        ],
      };
      changeRef.current({ ...v, content, updated: Date.now() });
      setRevision((x) => x + 1);
      onAdded();
    };
    window.addEventListener("insert-excerpt", fn);
    return () => window.removeEventListener("insert-excerpt", fn);
  }, [blocked]);
  if (!n) return null;
  return (
    <>
      {actionsHost &&
        createPortal(
          <DeleteButton
            kind="note"
            title={n.title}
            disabled={blocked}
            onDelete={async () => {
              await remove();
              onDeleted();
            }}
          />,
          actionsHost,
        )}
      <div data-saving={status !== "Saved"}>
        <div className="note-editor-heading">
          <span className="eyebrow">YOUR NOTE</span>
        </div>
        <input
          className="note-title"
          aria-label="Note title"
          value={n.title}
          disabled={blocked}
          onChange={(e) =>
            change({ ...n, title: e.target.value, updated: Date.now() })
          }
          onBlur={() => flush()}
        />
        {!n.documentId && (
          <CourseSelect
            value={n.courseId}
            onChange={(courseId) =>
              change({ ...n, courseId, updated: Date.now() })
            }
          />
        )}
        <div className="save-line">
          <button className="text-button" onClick={() => flush()}>
            {status}
          </button>
          <span>
            {textOf(n.content).split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
        {blocked && !deleting && (
          <p className="banner">
            Open in another tab. Close it and reload to edit here.
          </p>
        )}
        <RichEditor
          key={revision}
          disabled={blocked}
          content={n.content}
          onChange={(content) =>
            change({ ...current.current!, content, updated: Date.now() })
          }
          onExcerpt={onReviewer}
        />
        <div className="actions note-actions">
          <button className="secondary" onClick={() => window.print()}>
            Print note / PDF
          </button>
        </div>
      </div>
    </>
  );
}
function PDFReader({
  doc,
  requestedPage,
  onExcerpt,
}: {
  doc: import("./data").Doc;
  requestedPage: number;
  onExcerpt: (ref: Ref) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(
    Number.isInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, doc.pages)
      : doc.page,
  );
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [hasText, setHasText] = useState(true);
  const [width, setWidth] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let gone = false;
    let loaded: PDFDocumentProxy | undefined;
    doc.blob
      .arrayBuffer()
      .then((bytes) => getDocument({ data: new Uint8Array(bytes) }).promise)
      .then((p) => {
        loaded = p;
        if (gone) p.destroy();
        else setPdf(p);
      })
      .catch((e) => !gone && setError(`Unable to open this PDF: ${e.message}`));
    return () => {
      gone = true;
      loaded?.destroy();
    };
  }, [doc.id]);
  useEffect(() => {
    if (Number.isInteger(requestedPage) && requestedPage > 0)
      setPage(Math.min(requestedPage, doc.pages));
  }, [requestedPage]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.round(entries[0].contentRect.width)),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !canvas.current || !layer.current) return;
    let cancelled = false;
    let rendering: any;
    let textLayer: TextLayer | undefined;
    pdf
      .getPage(page)
      .then(async (p) => {
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const available = Math.max(
          200,
          (container.current?.clientWidth || 600) - 32,
        );
        const viewport = p.getViewport({
          scale: (available / base.width) * zoom,
        });
        const c = canvas.current!;
        const dpr = window.devicePixelRatio || 1;
        c.width = viewport.width * dpr;
        c.height = viewport.height * dpr;
        c.style.width = `${viewport.width}px`;
        c.style.height = `${viewport.height}px`;
        layer.current!.replaceChildren();
        layer.current!.style.setProperty(
          "--scale-factor",
          String(viewport.scale),
        );
        rendering = p.render({
          canvasContext: c.getContext("2d")!,
          viewport,
          transform: [dpr, 0, 0, dpr, 0, 0],
        });
        await rendering.promise;
        if (cancelled) return;
        const text = await p.getTextContent();
        if (cancelled) return;
        setHasText(text.items.some((i: any) => i.str?.trim()));
        textLayer = new TextLayer({
          textContentSource: text,
          container: layer.current!,
          viewport,
        });
        await textLayer.render();
      })
      .catch((e) => {
        if (!cancelled && e.name !== "RenderingCancelledException")
          setError(e.message);
      });
    db.documents.update(doc.id, { page, lastOpened: Date.now() }).catch(report);
    return () => {
      cancelled = true;
      rendering?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, page, zoom, width]);
  return (
    <>
      <div className="reader-toolbar">
        <button
          aria-label="Previous page"
          className="icon-button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <label>
          Page{" "}
          <input
            type="number"
            min="1"
            max={doc.pages}
            value={page}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 1 && v <= doc.pages) setPage(v);
            }}
          />{" "}
          / {doc.pages}
        </label>
        <button
          aria-label="Next page"
          className="icon-button"
          disabled={page >= doc.pages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
        <button
          aria-label="Zoom out"
          className="icon-button"
          onClick={() => setZoom(Math.max(0.5, zoom - 0.15))}
        >
          <Minus size={16} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          aria-label="Zoom in"
          className="icon-button"
          onClick={() => setZoom(Math.min(3, zoom + 0.15))}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="reader-hint">
        <span>Select a passage to keep with your notes.</span>
        <button
          className="secondary"
          onClick={() => {
            const selection = window.getSelection();
            const quote = selection?.toString().trim();
            if (
              !quote ||
              !container.current?.contains(selection?.anchorNode || null)
            )
              return report("Select text from the PDF first.");
            onExcerpt({ documentId: doc.id, page, quote });
          }}
        >
          Add excerpt
        </button>
      </div>
      {error ? (
        <p role="alert" className="banner">
          {error}
        </p>
      ) : (
        <div className="pdf-scroll" ref={container}>
          {!pdf && <p>Opening your PDF…</p>}
          <div className="pdf-page">
            <canvas ref={canvas} />
            <div ref={layer} className="textLayer" />
          </div>
        </div>
      )}
      {!hasText && (
        <p className="banner">
          This page has no selectable text. You can still read it and write
          notes manually.
        </p>
      )}
    </>
  );
}
