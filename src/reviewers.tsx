import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "./storage/live";
import { db, uid, templates, section, type Reviewer } from "./data";
import { PageTitle, CourseSelect, Source, useRecordDraft } from "./shared";
import { Plus, BookOpen, Search, Download, Trash2 } from "lucide-react";
export function Reviewers() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const items =
    useLiveQuery(
      () => db.reviewers.orderBy("updated").reverse().toArray(),
      [],
    ) || [];
  return (
    <>
      <PageTitle
        eyebrow="CONNECT • UNDERSTAND • REMEMBER"
        title="In your own words."
        description="Turn your notes into something you can return to."
      >
        <button
          onClick={async () => {
            const r: Reviewer = {
              id: uid(),
              title: "Untitled reviewer",
              courseId: course,
              tags: "",
              sections: [],
              updated: Date.now(),
            };
            await db.reviewers.add(r);
            navigate(`/reviewers/${r.id}`);
          }}
        >
          <Plus size={17} />
          New reviewer
        </button>
      </PageTitle>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            placeholder="Search reviewers and their content…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <CourseSelect value={course} onChange={setCourse} filter />
      </div>
      <div className="document-grid">
        {items
          .filter(
            (r) =>
              (!course || r.courseId === course) &&
              `${r.title} ${r.tags} ${r.sections.map((s) => Object.values(s.fields).join(" ")).join(" ")}`
                .toLowerCase()
                .includes(q.toLowerCase()),
          )
          .map((r) => (
            <article key={r.id} className="reviewer-card panel">
              <BookOpen />
              <Link to={`/reviewers/${r.id}`}>
                <h2>{r.title}</h2>
              </Link>
              <p className="muted">
                {r.sections.length} sections ·{" "}
                {new Date(r.updated).toLocaleDateString()}
              </p>
              <p>{r.tags}</p>
              <Link to={`/reviewers/${r.id}`}>Open reviewer →</Link>
            </article>
          ))}
      </div>
      {!items.length && (
        <div className="empty panel">
          <BookOpen size={32} />
          <h2>Your understanding deserves a home</h2>
          <p>
            Start with a concept, a theory comparison, or a research summary.
          </p>
        </div>
      )}
    </>
  );
}
export function ReviewerPage() {
  const { id } = useParams();
  return <ReviewerContent key={id} id={id!} />;
}
function ReviewerContent({ id }: { id: string }) {
  const record = useLiveQuery(() => db.reviewers.get(id), [id]);
  const {
    draft: r,
    change,
    status,
    flush,
    blocked,
  } = useRecordDraft(record, "reviewers");
  const [practice, setPractice] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  if (!r)
    return (
      <div className="empty">
        Loading reviewer… <Link to="/reviewers">Back to reviewers</Link>
      </div>
    );
  const update = (fields: Partial<Reviewer>) =>
    change({ ...r, ...fields, updated: Date.now() });
  return (
    <div data-saving={status !== "Saved"}>
      <PageTitle
        eyebrow="YOUR PERSONAL REVIEWER"
        title={practice ? r.title : "Build your understanding"}
        description="Write it simply. Connect it to what you know."
      >
        <div className="actions">
          <button
            className="secondary"
            onClick={() => {
              flush();
              setPractice(!practice);
              setRevealed(new Set());
            }}
          >
            {practice ? "Edit reviewer" : "Practice"}
          </button>
          <button
            className="secondary"
            onClick={() => {
              void flush();
              setPractice(true);
              setRevealed(new Set(r.sections.map((s) => s.id)));
              setTimeout(() => window.print(), 100);
            }}
          >
            <Download size={16} />
            Print / PDF
          </button>
        </div>
      </PageTitle>
      {blocked && (
        <p className="banner">
          This reviewer is open for editing in another tab. Close that tab and
          reload to edit here.
        </p>
      )}
      <div className="editor-meta no-print">
        <label>
          Reviewer title
          <input
            value={r.title}
            disabled={blocked}
            onChange={(e) => update({ title: e.target.value })}
            onBlur={() => flush()}
          />
        </label>
        <CourseSelect
          value={r.courseId}
          onChange={(courseId) => update({ courseId })}
        />
        <label>
          Topic tags
          <input
            value={r.tags}
            onChange={(e) => update({ tags: e.target.value })}
          />
        </label>
        <button className="text-button" onClick={() => flush()}>
          {status}
        </button>
      </div>
      <div className="reviewer-sections">
        {r.sections.map((s) => (
          <section className="panel reviewer-section" key={s.id}>
            <div className="section-heading">
              <span className="eyebrow">{s.kind}</span>
              {!practice && (
                <button
                  className="icon-button no-print"
                  aria-label="Remove section"
                  disabled={blocked}
                  onClick={() =>
                    update({
                      sections: r.sections.filter((x) => x.id !== s.id),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {Object.entries(s.fields).map(([key, value]) => (
              <div key={key} className="review-field">
                <label>{key}</label>
                {practice ? (
                  <div>
                    {key === "Answer" && !revealed.has(s.id) ? (
                      <button
                        className="secondary"
                        onClick={() =>
                          setRevealed(new Set([...revealed, s.id]))
                        }
                      >
                        Reveal answer
                      </button>
                    ) : (
                      <p className="preserve">
                        {value || "Not filled in yet."}
                      </p>
                    )}
                  </div>
                ) : (
                  <textarea
                    aria-label={key}
                    disabled={blocked}
                    value={value}
                    onBlur={() => flush()}
                    onChange={(e) =>
                      update({
                        sections: r.sections.map((x) =>
                          x.id === s.id
                            ? {
                                ...x,
                                fields: { ...x.fields, [key]: e.target.value },
                              }
                            : x,
                        ),
                      })
                    }
                  />
                )}
              </div>
            ))}
            {s.refs.map((ref, i) => (
              <div key={i}>
                <blockquote>{ref.quote}</blockquote>
                <Source source={ref} />
              </div>
            ))}
          </section>
        ))}
      </div>
      {!practice && (
        <div className="panel no-print">
          <h3>Add a section</h3>
          <div className="actions wrap">
            {Object.keys(templates).map((kind) => (
              <button
                className="secondary"
                disabled={blocked}
                key={kind}
                onClick={() =>
                  update({ sections: [...r.sections, section(kind)] })
                }
              >
                <Plus size={15} />
                {kind}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        className="danger no-print"
        disabled={blocked}
        onClick={async () => {
          if (confirm("Delete this reviewer?")) {
            await flush();
            await db.reviewers.delete(r.id);
            navigate("/reviewers");
          }
        }}
      >
        Delete reviewer
      </button>
    </div>
  );
}
