import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./data";
import { PageTitle } from "./shared";
import { GoalRow } from "./goals";
import {
  Plus,
  Leaf,
  Library as LibraryIcon,
  BookOpen,
  Check,
  Target,
  ArrowUpRight,
  FileText,
} from "lucide-react";
export function Home() {
  const docs =
    useLiveQuery(
      async () =>
        (await db.documents.toArray())
          .sort(
            (a, b) => (b.lastOpened || b.created) - (a.lastOpened || a.created),
          )
          .slice(0, 3),
      [],
    ) || [];
  const goals =
    useLiveQuery(() => db.goals.orderBy("created").reverse().toArray(), []) ||
    [];
  const reviewers =
    useLiveQuery(
      () => db.reviewers.orderBy("updated").reverse().limit(3).toArray(),
      [],
    ) || [];
  const courses = useLiveQuery(() => db.courses.count(), []) || 0;
  const count = useLiveQuery(() => db.documents.count(), []) || 0;
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE PROGRESS, EVERY DAY"
        title="Make room for understanding."
        description="Your notes, your materials, your next small step."
      />
      <section className="hero">
        <div>
          <span className="pill">INTENTIONAL STUDY</span>
          <h2>
            One clear goal.
            <br />
            One focused session.
          </h2>
          <p>
            You don’t have to learn everything today.
            <br />
            Start with something you can finish.
          </p>
          <Link className="button" to="/goals">
            <Plus size={17} />
            Set a study goal
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit" />
          <div className="paper paper-back" />
          <div className="paper">
            <Leaf size={35} />
            <span>
              small steps,
              <br />
              <em>deeper understanding.</em>
            </span>
            <i />
            <i />
          </div>
          <span className="spark">✧</span>
        </div>
      </section>
      <div className="stats">
        <div>
          <span className="stat-icon">
            <LibraryIcon />
          </span>
          <strong>{count}</strong>
          <span>Saved materials</span>
        </div>
        <div>
          <span className="stat-icon">
            <BookOpen />
          </span>
          <strong>{courses}</strong>
          <span>Courses to explore</span>
        </div>
        <div>
          <span className="stat-icon">
            <Check />
          </span>
          <strong>{goals.filter((g) => g.done).length}</strong>
          <span>Goals completed</span>
        </div>
      </div>
      <section className="section">
        <div className="section-heading">
          <h2>Your next small steps</h2>
          <Link to="/goals">
            All goals <ArrowUpRight size={15} />
          </Link>
        </div>
        {goals.filter((g) => !g.done).length ? (
          goals
            .filter((g) => !g.done)
            .slice(0, 3)
            .map((g) => <GoalRow key={g.id} goal={g} />)
        ) : (
          <div className="empty compact">
            <Target />
            <h3>Give your next session a purpose</h3>
            <p>Choose a topic and describe what “finished” looks like.</p>
            <Link to="/goals">Create your first goal →</Link>
          </div>
        )}
      </section>
      <div className="two-column">
        <section className="section">
          <div className="section-heading">
            <h2>Pick up where you left off</h2>
            <Link to="/library">Library ↗</Link>
          </div>
          {docs.length ? (
            docs.map((d) => (
              <Link className="material-row" to={`/study/${d.id}`} key={d.id}>
                <span className="file-icon">
                  <FileText />
                </span>
                <div>
                  <strong>{d.title}</strong>
                  <p>
                    {d.pages} pages · Continue on page {d.page}
                  </p>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))
          ) : (
            <div className="empty compact">
              <FileText />
              <h3>Your reading starts here</h3>
              <p>Bring your lecture slides and readings into one place.</p>
              <Link to="/library">Import a PDF →</Link>
            </div>
          )}
        </section>
        <section className="section">
          <div className="section-heading">
            <h2>Made for future you</h2>
            <Link to="/reviewers">Reviewers ↗</Link>
          </div>
          {reviewers.length ? (
            reviewers.map((r) => (
              <Link
                className="material-row"
                to={`/reviewers/${r.id}`}
                key={r.id}
              >
                <span className="file-icon warm">
                  <BookOpen />
                </span>
                <div>
                  <strong>{r.title}</strong>
                  <p>{r.sections.length} sections · Your own understanding</p>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))
          ) : (
            <div className="empty compact">
              <BookOpen />
              <h3>Understanding, in your words</h3>
              <p>Build a reviewer one concept at a time.</p>
              <Link to="/reviewers">Create a reviewer →</Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
