import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  uid,
  importPDF,
  removeCourse,
  removeDocument,
  removeNote,
  textOf,
  type Note,
  type Doc,
} from "./data";
import { PageTitle, CourseSelect, report } from "./shared";
import { GoalRow } from "./goals";
import { DeleteButton } from "./delete";
import { Plus, Upload, ArrowUpRight, Search, FileText } from "lucide-react";
export function Library({ courseView = false }: { courseView?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState("");
  const [busy, setBusy] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#688975");
  const [showCourse, setShowCourse] = useState(false);
  const courses = useLiveQuery(() => db.courses.toArray(), []) || [];
  const current = courses.find((c) => c.id === id);
  const docs = useLiveQuery(() => db.documents.toArray(), []) || [];
  const notes = useLiveQuery(() => db.notes.toArray(), []) || [];
  const reviewers = useLiveQuery(() => db.reviewers.toArray(), []) || [];
  const goals = useLiveQuery(() => db.goals.toArray(), []) || [];
  const selected = courseView ? id || "" : course;
  const filtered = docs.filter(
    (d) =>
      (!selected || d.courseId === selected) &&
      `${d.title} ${d.tags}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const result = await importPDF(f, selected);
        if (result.duplicate)
          report("This PDF is already saved. Opening the existing copy.");
        navigate(`/study/${result.id}`);
      }
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={courseView ? "YOUR COURSE" : "COLLECT • ORGANIZE • EXPLORE"}
        title={
          courseView
            ? current?.name || "Course unavailable"
            : "Your study library"
        }
        description={
          courseView
            ? current?.description || "Materials and ideas, connected."
            : "A home for your readings, lecture slides, and ideas."
        }
      >
        <div className="actions">
          <button
            className="secondary"
            onClick={() => setShowCourse(!showCourse)}
          >
            <Plus size={17} />
            New course
          </button>
          <label className="button">
            {busy ? (
              "Importing…"
            ) : (
              <>
                <Upload size={17} />
                Import PDF
              </>
            )}
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={busy}
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = "";
              }}
              hidden
            />
          </label>
        </div>
      </PageTitle>
      {showCourse && (
        <form
          className="panel inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await db.courses.add({
              id: uid(),
              name: courseName.trim(),
              description,
              color,
            });
            setCourseName("");
            setDescription("");
            setShowCourse(false);
          }}
        >
          <label>
            Course name
            <input
              required
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. Cognitive Psychology"
            />
          </label>
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <button>Create course</button>
        </form>
      )}
      {!courseView && courses.length > 0 && (
        <div className="course-grid">
          {courses.map((c) => (
            <Link to={`/courses/${c.id}`} className="course-card" key={c.id}>
              <i style={{ background: c.color }} />
              <h3>{c.name}</h3>
              <p>
                {docs.filter((d) => d.courseId === c.id).length} materials{" "}
                <ArrowUpRight size={14} />
              </p>
            </Link>
          ))}
        </div>
      )}
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search PDFs"
            placeholder="Search titles or topic tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {!courseView && (
          <CourseSelect value={course} onChange={setCourse} filter />
        )}
        <span className="muted small">{filtered.length} materials</span>
      </div>
      <div className="document-grid">
        {filtered.map((d) => (
          <DocumentCard key={d.id} doc={d} />
        ))}
      </div>
      {!filtered.length && (
        <div className="empty panel">
          <Upload size={32} />
          <h2>Make space for your materials</h2>
          <p>
            Import a PDF to read, take notes, and build your reviewer. Files
            stay on this device.
          </p>
          <p className="small">
            PDF files up to 50 MB · Scanned pages can be read without text
            selection
          </p>
        </div>
      )}
      {courseView && (
        <>
          <section className="section">
            <h2>Course reviewers</h2>
            {reviewers
              .filter((r) => r.courseId === id)
              .map((r) => (
                <Link
                  className="material-row"
                  key={r.id}
                  to={`/reviewers/${r.id}`}
                >
                  {r.title} ↗
                </Link>
              ))}
          </section>
          <section className="section">
            <h2>Course goals</h2>
            {goals
              .filter((g) => g.courseId === id)
              .map((g) => (
                <GoalRow goal={g} key={g.id} />
              ))}
          </section>
          {current && (
            <button
              className="danger"
              onClick={async () => {
                if (
                  confirm(
                    "Delete this course? Its materials will move to Unfiled.",
                  )
                ) {
                  await removeCourse(current.id);
                  navigate("/library");
                }
              }}
            >
              Delete course
            </button>
          )}
        </>
      )}
      <section className="section">
        <div className="section-heading">
          <h2>{courseView ? "Course notes" : "Your notes"}</h2>
          <button
            className="secondary"
            onClick={async () => {
              const note: Note = {
                id: uid(),
                title: "Untitled note",
                courseId: selected,
                content: { type: "doc", content: [{ type: "paragraph" }] },
                updated: Date.now(),
              };
              await db.notes.add(note);
              navigate(`/study/note-${note.id}`);
            }}
          >
            <Plus size={16} />
            New note
          </button>
        </div>
        {notes
          .filter(
            (n) =>
              (!selected || n.courseId === selected) &&
              `${n.title} ${textOf(n.content)}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          )
          .map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
      </section>
    </>
  );
}
function NoteRow({ note }: { note: Note }) {
  return (
    <article
      className="material-row note-row"
      aria-label={`Note: ${note.title}`}
    >
      <Link className="note-row-link" to={`/study/note-${note.id}`}>
        <FileText size={18} aria-hidden="true" />
        <span>{note.title}</span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
      <DeleteButton
        kind="note"
        title={note.title}
        onDelete={() => removeNote(note.id)}
      />
    </article>
  );
}
function DocumentCard({ doc }: { doc: Doc }) {
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [tags, setTags] = useState(doc.tags);
  return (
    <article className="document-card">
      <Link to={`/study/${doc.id}`} className="document-cover">
        <FileText size={42} />
        <span>PDF DOCUMENT</span>
        <strong>{doc.title}</strong>
      </Link>
      <div className="document-info">
        <Link to={`/study/${doc.id}`}>
          <h3>{doc.title}</h3>
        </Link>
        <p>
          {doc.pages} pages · Page {doc.page}
        </p>
        {doc.tags && <span className="tag">{doc.tags}</span>}
        <div className="actions">
          <button className="text-button" onClick={() => setEdit(!edit)}>
            Edit details
          </button>
          <DeleteButton
            kind="PDF"
            title={doc.title}
            onDelete={() => removeDocument(doc.id)}
          />
        </div>
        {edit && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await db.documents.update(doc.id, { title: title.trim(), tags });
              setEdit(false);
            }}
          >
            <label>
              Title
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Topic tags
              <input value={tags} onChange={(e) => setTags(e.target.value)} />
            </label>
            <CourseSelect
              value={doc.courseId}
              onChange={(courseId) => {
                db.documents.update(doc.id, { courseId }).catch(report);
                db.notes
                  .where("documentId")
                  .equals(doc.id)
                  .modify({ courseId })
                  .catch(report);
              }}
            />
            <button>Save</button>
          </form>
        )}
      </div>
    </article>
  );
}
