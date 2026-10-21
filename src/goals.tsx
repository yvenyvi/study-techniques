import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "./storage/live";
import { db, uid, type Goal } from "./data";
import { PageTitle, report } from "./shared";
import { GuidePage } from "./guides";
import { GoalDropdown } from "./goal-dropdown";
import { Plus, Check, Target } from "lucide-react";
export function GoalRow({ goal: g }: { goal: Goal }) {
  return (
    <div className="goal-row">
      <button
        className={`goal-check ${g.done ? "checked" : ""}`}
        aria-label={g.done ? "Reopen goal" : "Complete goal"}
        onClick={() =>
          db.goals
            .update(g.id, {
              done: !g.done,
              completed: g.done ? undefined : Date.now(),
            })
            .catch(report)
        }
      >
        {g.done && <Check size={15} />}
      </button>
      <div>
        <strong>{g.title}</strong>
        <p>{g.criterion}</p>
        {g.materialIds.map((id) => (
          <Link
            className="source"
            key={id}
            to={
              id.startsWith("reviewer:")
                ? `/reviewers/${id.slice(9)}`
                : `/study/${id}`
            }
          >
            Open material ↗{" "}
          </Link>
        ))}
      </div>
      {!g.done && (
        <button
          className="secondary"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("start-goal", { detail: g.id }),
            )
          }
        >
          Focus
        </button>
      )}
    </div>
  );
}
export function Goals() {
  const [title, setTitle] = useState("");
  const [criterion, setCriterion] = useState("");
  const [course, setCourse] = useState("");
  const [materials, setMaterials] = useState<string[]>([]);
  const goals =
    useLiveQuery(() => db.goals.orderBy("created").reverse().toArray(), []) ||
    [];
  const sessions =
    useLiveQuery(
      () => db.sessions.orderBy("started").reverse().toArray(),
      [],
    ) || [];
  const courses = useLiveQuery(() => db.courses.toArray(), []) || [];
  const docs = useLiveQuery(() => db.documents.toArray(), []) || [];
  const reviewers = useLiveQuery(() => db.reviewers.toArray(), []) || [];
  return (
    <>
      <GuidePage id="goals" />
      <PageTitle
        eyebrow="PROGRESS WITH PURPOSE"
        title="Small goals. Meaningful progress."
        description="Decide what finished looks like before you begin."
      />
      <form
        data-guide="goal-form"
        className="panel goal-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || !criterion.trim()) return;
          await db.goals.add({
            id: uid(),
            title: title.trim(),
            criterion: criterion.trim(),
            courseId: course,
            materialIds: materials,
            done: false,
            created: Date.now(),
          });
          setTitle("");
          setCriterion("");
          setMaterials([]);
        }}
      >
        <h2>What will you work toward?</h2>
        <div className="two-column">
          <label>
            Study goal
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Compare two models of memory"
            />
          </label>
          <label>
            Finished looks like…
            <input
              required
              value={criterion}
              onChange={(e) => setCriterion(e.target.value)}
              placeholder="Complete the comparison section in my reviewer"
            />
          </label>
        </div>
        <div className="goal-materials" data-guide="goal-materials">
          <GoalDropdown
            label="Course (optional)"
            help="Organize this goal under a course, or leave it as a general goal."
            options={[
              { value: "", label: "No course — general goal" },
              ...courses.map((item) => ({ value: item.id, label: item.name })),
            ]}
            selected={[course]}
            onChange={([value]) => setCourse(value)}
          />
          <GoalDropdown
            label="Study materials (optional)"
            help="Add shortcuts to PDFs or reviewers you'll use for this goal. Your files stay where they are."
            multiple
            options={[
              ...docs.map((item) => ({
                value: item.id,
                label: `PDF: ${item.title}`,
              })),
              ...reviewers.map((item) => ({
                value: `reviewer:${item.id}`,
                label: `Reviewer: ${item.title}`,
              })),
            ]}
            selected={materials}
            onChange={setMaterials}
          />
          <button className="goal-submit">
            <Plus size={16} />
            Create goal
          </button>
        </div>
      </form>
      <section className="section" data-guide="goal-list">
        <h2>Your goals</h2>
        {goals.length ? (
          goals.map((g) => <GoalRow key={g.id} goal={g} />)
        ) : (
          <p className="muted">Your first small step starts above.</p>
        )}
      </section>
      <section className="section" data-guide="focus-history">
        <h2>Focus history</h2>
        {sessions.length ? (
          sessions.map((s) => (
            <div className="history-row" key={s.id}>
              <span className="file-icon">
                <Target size={20} />
              </span>
              <div>
                <strong>
                  {goals.find((g) => g.id === s.goalId)?.title ||
                    "Independent focus session"}
                </strong>
                <p>
                  {new Date(s.started).toLocaleString()} ·{" "}
                  {Math.round(s.duration / 60)} focused minutes · {s.outcome}
                </p>
                {s.note && <p>{s.note}</p>}
              </div>
            </div>
          ))
        ) : (
          <p className="muted">
            Completed sessions will appear here. Time is a tool; your goal is
            the destination.
          </p>
        )}
      </section>
    </>
  );
}
