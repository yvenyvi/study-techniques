import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Routes,
  Route,
  NavLink,
  Link,
} from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  Home as HomeIcon,
  Library as LibraryIcon,
  Target,
  Settings as SettingsIcon,
  WifiOff,
} from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import { db } from "./data";
import { report, flushEditors } from "./shared";
import { FocusTimer } from "./timer";
import { Workspace } from "./workspace";
import { Home } from "./home";
import { Library } from "./library";
import { Reviewers, ReviewerPage } from "./reviewers";
import { Goals } from "./goals";
import { Settings } from "./settings";
import "./style.css";
function App() {
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [ready, setReady] = useState(false);
  const [update, setUpdate] = useState(false);
  const updater = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  useEffect(() => {
    const fn = (e: Event) => setNotice((e as CustomEvent).detail);
    const network = () => setOffline(!navigator.onLine);
    const rejected = (e: PromiseRejectionEvent) => {
      report(e.reason);
      e.preventDefault();
    };
    window.addEventListener("unhandledrejection", rejected);
    window.addEventListener("notice", fn);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    updater.current = registerSW({
      onOfflineReady() {
        setReady(true);
      },
      onNeedRefresh() {
        setUpdate(true);
      },
    });
    navigator.serviceWorker?.ready.then(() => setReady(true)).catch(() => {});
    return () => {
      window.removeEventListener("unhandledrejection", rejected);
      window.removeEventListener("notice", fn);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 8000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const courses = useLiveQuery(() => db.courses.toArray(), []) || [];
  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <BookOpen size={23} />
          </span>
          study room<span className="brand-dot">.</span>
        </Link>
        <p className="eyebrow side-label">YOUR WORKSPACE</p>
        <nav>
          {[
            ["/", "Overview", HomeIcon],
            ["/library", "Library", LibraryIcon],
            ["/reviewers", "Reviewers", BookOpen],
            ["/goals", "Goals & history", Target],
          ].map(([path, label, Icon]: any) => (
            <NavLink key={path} end={path === "/"} to={path}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="side-courses">
          <p className="eyebrow">YOUR COURSES</p>
          {courses.length ? (
            courses.map((c) => (
              <NavLink to={`/courses/${c.id}`} key={c.id}>
                <i style={{ background: c.color }} />
                {c.name}
              </NavLink>
            ))
          ) : (
            <p className="muted small">Add your first course in Library.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="offline-chip">
            {offline ? <WifiOff size={16} /> : <span className="status-dot" />}
            {offline
              ? "Working offline"
              : ready
                ? "Ready for offline study"
                : "Local workspace"}
          </div>
          <NavLink to="/settings">
            <SettingsIcon size={18} />
            Settings & data
          </NavLink>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>YOUR SPACE TO LEARN, AT YOUR PACE</span>
          <span className="profile">
            PS <span>Psychology student</span>
          </span>
        </header>
        {update && (
          <div className="banner">
            An update is available. Save your work and end your timer first.{" "}
            <button
              onClick={async () => {
                if ((await db.timers.get("active"))?.started)
                  return report("End the active session before updating.");
                if (await flushEditors()) await updater.current?.(true);
                else report("Please save your edits before updating.");
              }}
            >
              Apply update
            </button>
          </div>
        )}
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
            <Route path="/courses/:id" element={<Library courseView />} />
            <Route path="/study/:id" element={<Workspace />} />
            <Route path="/reviewers" element={<Reviewers />} />
            <Route path="/reviewers/:id" element={<ReviewerPage />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/settings" element={<Settings ready={ready} />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Page not found</h1>
                  <Link to="/">Return home</Link>
                </div>
              }
            />
          </Routes>
          <footer className="app-dedication">
            Dedicated to Ivory Frias, the developer’s beloved.
          </footer>
        </main>
        <FocusTimer />
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
// Version-1 backups (including the native app) use /study/:id source links.
// Keep those links and earlier bookmarks working without changing saved content.
if (!/^\/app(?:\/|$)/.test(location.pathname)) {
  const path = location.pathname === "/app.html" ? "/" : location.pathname;
  history.replaceState(
    null,
    "",
    `/app${path}${location.search}${location.hash}`,
  );
}
createRoot(document.getElementById("root")!).render(
  <RouterProvider
    router={createBrowserRouter([{ path: "*", element: <App /> }], {
      basename: "/app",
    })}
  />,
);
