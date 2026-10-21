import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  CircleHelp,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  MousePointer2,
} from "lucide-react";
import { guides, guideIds, type GuideId } from "./guides-content";
import { hasSeenGuide, markGuideSeen } from "./guides-progress";
import "./guides.css";

export function GuidePage({ id }: { id: GuideId }) {
  return <span hidden data-guide-page={id} />;
}

function findTarget(selector: string): HTMLElement | undefined {
  // Fallback selectors are ordered: prefer the most specific visible control.
  for (const part of selector.split(",")) {
    for (const element of document.querySelectorAll<HTMLElement>(part.trim())) {
      const rect = element.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(element).visibility !== "hidden"
      )
        return element;
    }
  }
}

type Tour = { id: GuideId; step: number; tried: number[]; manual: boolean };
type Box = { top: number; left: number; width: number; height: number };

export function PageGuides() {
  const { pathname } = useLocation();
  const [page, setPage] = useState<GuideId | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [position, setPosition] = useState({
    top: 16,
    left: 16,
    maxHeight: 600,
  });
  const card = useRef<HTMLElement>(null);
  const help = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const descriptionId = useId();
  const titleId = useId();
  const cardId = useId();
  const step = tour ? guides[tour.id].steps[tour.step] : undefined;
  const start = useCallback((id: GuideId, manual: boolean) => {
    markGuideSeen(id);
    returnFocus.current = manual ? help.current : null;
    setTour({ id, step: 0, tried: [], manual });
  }, []);
  const close = useCallback(() => {
    setTour(null);
    if (returnFocus.current?.isConnected)
      returnFocus.current.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    setPage(null);
    setTour(null);
    const main = document.querySelector("main");
    if (!main) return;
    let current: string | null = null;
    let disposed = false;
    const refresh = () => {
      if (disposed) return;
      const id =
        main.querySelector<HTMLElement>("[data-guide-page]")?.dataset.guidePage;
      if (!id || !guideIds.includes(id as GuideId) || current === id) return;
      current = id;
      setPage(id as GuideId);
      setTour(null);
      if (!hasSeenGuide(id as GuideId)) start(id as GuideId, false);
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-guide-page"],
    });
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [pathname, start]);

  useEffect(() => {
    const reset = () => setTour(null);
    window.addEventListener("reset-page-guides", reset);
    return () => window.removeEventListener("reset-page-guides", reset);
  }, []);

  useLayoutEffect(() => {
    if (!tour || !step) return;
    const panel = step.panel || (tour.id === "note" ? "notes" : undefined);
    if (panel)
      window.dispatchEvent(
        new CustomEvent("guide-show-panel", { detail: panel }),
      );
    let frame = 0;
    let first = true;
    const update = () => {
      const viewportHeight = Math.min(
        innerHeight,
        window.visualViewport?.height || innerHeight,
      );
      const target = findTarget(step.target);
      if (target && first) {
        first = false;
        const rect = target.getBoundingClientRect();
        if (rect.top < 8 || rect.bottom > viewportHeight - 12)
          target.scrollIntoView({ block: "center", behavior: "instant" });
      }
      const rect = target?.getBoundingClientRect();
      const width = Math.min(360, innerWidth - 24);
      const height = card.current?.getBoundingClientRect().height || 280;
      const maxTop = Math.max(12, viewportHeight - height - 12);
      let left = (innerWidth - width) / 2;
      let top = maxTop;
      if (rect) {
        const clippedTop = Math.max(6, rect.top - 5);
        const clippedBottom = Math.min(viewportHeight - 6, rect.bottom + 5);
        setBox(
          clippedBottom > clippedTop
            ? {
                top: clippedTop,
                left: Math.max(6, rect.left - 5),
                width: Math.min(innerWidth - 12, rect.width + 10),
                height: Math.max(0, clippedBottom - clippedTop),
              }
            : null,
        );
        if (innerWidth >= 700 && rect.right + width + 24 <= innerWidth) {
          left = rect.right + 12;
          top = Math.min(maxTop, Math.max(12, rect.top));
        } else if (innerWidth >= 700 && rect.left - width - 24 >= 0) {
          left = rect.left - width - 12;
          top = Math.min(maxTop, Math.max(12, rect.top));
        } else if (rect.bottom + height + 24 < viewportHeight) {
          left = Math.min(innerWidth - width - 12, Math.max(12, rect.left));
          top = rect.bottom + 12;
        } else if (rect.top > height + 24) {
          left = Math.min(innerWidth - width - 12, Math.max(12, rect.left));
          top = rect.top - height - 12;
        }
      } else setBox(null);
      setPosition({
        top: Math.min(maxTop, Math.max(12, top)),
        left: Math.min(innerWidth - width - 12, Math.max(12, left)),
        maxHeight: viewportHeight - 24,
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    const observer = new MutationObserver(schedule);
    const main = document.querySelector("main");
    if (main)
      observer.observe(main, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "hidden"],
      });
    const resize = new ResizeObserver(schedule);
    if (card.current) resize.observe(card.current);
    const target = findTarget(step.target);
    if (target) resize.observe(target);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    const interact = (event: Event) => {
      const target = findTarget(step.target);
      if (!step.interaction || !target?.contains(event.target as Node)) return;
      setTour((value) =>
        value &&
        value.id === tour.id &&
        value.step === tour.step &&
        !value.tried.includes(value.step)
          ? { ...value, tried: [...value.tried, value.step] }
          : value,
      );
    };
    if (step.interaction)
      document.addEventListener(step.interaction, interact, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      if (step.interaction)
        document.removeEventListener(step.interaction, interact, true);
    };
  }, [tour?.id, tour?.step, step]);

  useEffect(() => {
    if (!tour) return;
    if (tour.manual) next.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]"))
        return;
      event.preventDefault();
      close();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [tour?.id, tour?.manual, close]);

  const advance = (amount: number) =>
    setTour((value) =>
      value ? { ...value, step: value.step + amount } : value,
    );
  return (
    <>
      <button
        ref={help}
        type="button"
        className="page-guide-button"
        disabled={!page}
        title="Replay this page’s guide"
        aria-expanded={!!tour}
        aria-controls={tour ? cardId : undefined}
        onClick={() => page && start(page, true)}
      >
        <CircleHelp size={17} /> Page guide
      </button>
      {tour &&
        step &&
        createPortal(
          <div className="page-guide-layer">
            {box && (
              <div
                aria-hidden="true"
                className="page-guide-highlight"
                style={box}
              />
            )}
            <section
              ref={card}
              id={cardId}
              role="dialog"
              aria-modal="false"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              className="page-guide-card"
              style={position}
              onKeyDown={(event) => {
                if (
                  event.target !== next.current &&
                  event.target !== card.current
                )
                  return;
                if (event.key === "ArrowLeft" && tour.step > 0) {
                  event.preventDefault();
                  advance(-1);
                }
                if (
                  event.key === "ArrowRight" &&
                  tour.step < guides[tour.id].steps.length - 1
                ) {
                  event.preventDefault();
                  advance(1);
                }
              }}
            >
              <div className="page-guide-topline">
                <span>{guides[tour.id].title} guide</span>
                <button
                  type="button"
                  className="page-guide-close"
                  aria-label="Close guide"
                  onClick={close}
                >
                  <X size={17} />
                </button>
              </div>
              <div className="page-guide-step-row">
                <p
                  className="page-guide-counter"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  Step {tour.step + 1} of {guides[tour.id].steps.length}
                </p>
                <button
                  type="button"
                  className="page-guide-show"
                  onClick={() => {
                    const target = findTarget(step.target);
                    target?.scrollIntoView({
                      block: "center",
                      behavior: "instant",
                    });
                    if (target?.matches("button, input, select, textarea"))
                      target.focus({ preventScroll: true });
                  }}
                >
                  Show me
                </button>
              </div>
              <div aria-live="polite" aria-atomic="true">
                <h2 id={titleId}>{step.title}</h2>
                <p id={descriptionId}>{step.body}</p>
              </div>
              {step.tryIt && (
                <div
                  className={`page-guide-try ${tour.tried.includes(tour.step) ? "tried" : ""}`}
                >
                  {tour.tried.includes(tour.step) ? (
                    <>
                      <Check size={17} />
                      <span>You tried it! Continue when you’re ready.</span>
                    </>
                  ) : (
                    <>
                      <MousePointer2 size={17} />
                      <span>Optional: {step.tryIt}</span>
                    </>
                  )}
                </div>
              )}
              <div className="page-guide-actions">
                <button
                  type="button"
                  className="page-guide-skip"
                  onClick={close}
                >
                  Skip guide
                </button>
                <div>
                  <button
                    type="button"
                    className="page-guide-back"
                    disabled={tour.step === 0}
                    onClick={() => advance(-1)}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    ref={next}
                    type="button"
                    className="page-guide-next"
                    onClick={() =>
                      tour.step === guides[tour.id].steps.length - 1
                        ? close()
                        : advance(1)
                    }
                  >
                    {tour.step === guides[tour.id].steps.length - 1 ? (
                      <>
                        Finish <Check size={14} />
                      </>
                    ) : (
                      <>
                        Next <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
              <small>
                You can use the page during this guide. Replay it anytime with
                Page guide.
              </small>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
