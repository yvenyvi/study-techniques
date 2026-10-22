import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  createHashRouter,
  useLocation,
  RouterProvider,
  Routes,
  Route,
  NavLink,
  Link,
} from "react-router-dom";
import { useLiveQuery } from "./storage/live";
import {
  BookOpen,
  Home as HomeIcon,
  Library as LibraryIcon,
  Target,
  Settings as SettingsIcon,
  WifiOff,
  Timer as TimerIcon,
} from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import { db, initializeStorage } from "./data";
import { isDesktop } from "./platform";
import { DesktopStore } from "./storage/desktop";
import { report, flushEditors } from "./shared";
import { FocusZone } from "./focus-zone";
import { FocusTimer } from "./timer";
import { Workspace } from "./workspace";
import { Home } from "./home";
import { Library } from "./library";
import { Reviewers, ReviewerPage } from "./reviewers";
import { Goals } from "./goals";
import { Settings } from "./settings";
import { PageGuides } from "./guides";
import { DesktopUpdatesProvider, DesktopUpdateBanner } from "./desktop-updates";
import "./style.css";
function App() {
  const location = useLocation();
  const inFocusZone = location.pathname === "/focus";
  const returnTo = useRef("/goals");
  useEffect(() => {
    if (!inFocusZone) returnTo.current = location.pathname;
  }, [location.pathname, inFocusZone]);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [ready, setReady] = useState(isDesktop);
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
    if (!isDesktop) {
      updater.current = registerSW({
        onOfflineReady() {
          setReady(true);
        },
        onNeedRefresh() {
          setUpdate(true);
        },
      });
      navigator.serviceWorker?.ready.then(() => setReady(true)).catch(() => {});
    }
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
    <div className={`app ${inFocusZone ? "in-focus-zone" : ""}`}>
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
            ["/focus", "Focus zone", TimerIcon],
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
            {isDesktop
              ? "Desktop · saved on this computer"
              : offline
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
          <div className="topbar-actions">
            <PageGuides />
            <span className="profile">
              PS <span>Psychology student</span>
            </span>
          </div>
        </header>
        {!inFocusZone && <DesktopUpdateBanner />}
        {update && !inFocusZone && (
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
            <Route
              path="/focus"
              element={<FocusZone returnTo={returnTo.current} />}
            />
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
        <FocusTimer zone={inFocusZone} />
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
if (!isDesktop && !/^\/app(?:\/|$)/.test(location.pathname)) {
  const path = location.pathname === "/app.html" ? "/" : location.pathname;
  history.replaceState(
    null,
    "",
    `/app${path}${location.search}${location.hash}`,
  );
}
const root = createRoot(document.getElementById("root")!);
async function start() {
  try {
    await initializeStorage();
    if (isDesktop) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      let closing = false;
      await getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        if (closing) return;
        closing = true;
        try {
          if (await flushEditors()) {
            if (db instanceof DesktopStore) await db.settle();
            await getCurrentWindow().destroy();
          } else
            report(
              "Your edits could not be saved. Retry saving before closing Study Room.",
            );
        } catch (error) {
          report(error);
        } finally {
          closing = false;
        }
      });
    }
    const routes = [{ path: "*", element: <App /> }];
    root.render(
      <DesktopUpdatesProvider>
        <RouterProvider
          router={
            isDesktop
              ? createHashRouter(routes)
              : createBrowserRouter(routes, { basename: "/app" })
          }
        />
      </DesktopUpdatesProvider>,
    );
  } catch (error) {
    root.render(
      <main className="empty">
        <h1>Your library could not be opened</h1>
        <p role="alert">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <p>
          Your existing files have been kept. Check that your disk is available,
          then retry.
        </p>
        <button onClick={() => location.reload()}>Retry opening library</button>
      </main>,
    );
  }
}
void start();
