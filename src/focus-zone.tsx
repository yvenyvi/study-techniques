import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pause, Play } from "lucide-react";
import "./focus-zone.css";

export function FocusZone({ returnTo }: { returnTo: string }) {
  const [motion, setMotion] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (preference.matches) setMotion(false);
    };
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  return (
    <div className="focus-zone-scene" data-motion={motion ? "on" : "off"}>
      <div className="focus-zone-art" aria-hidden="true">
        <div className="zone-glow zone-glow-one" />
        <div className="zone-glow zone-glow-two" />
        <div className="zone-contours" />
        <div className="zone-grain" />
      </div>
      <header className="focus-zone-topbar">
        <Link className="zone-back" to={returnTo}>
          <ArrowLeft size={16} /> Leave focus zone
        </Link>
        <button
          className="zone-motion"
          type="button"
          aria-pressed={!motion}
          aria-label={
            motion ? "Pause background motion" : "Resume background motion"
          }
          onClick={() => setMotion(!motion)}
        >
          {motion ? <Pause size={15} /> : <Play size={15} />}
          <span>{motion ? "Pause motion" : "Resume motion"}</span>
        </button>
      </header>
      <p className="focus-zone-caption">
        One thing at a time. There is room to begin.
      </p>
    </div>
  );
}
