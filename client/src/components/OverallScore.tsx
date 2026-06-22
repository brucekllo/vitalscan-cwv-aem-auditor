import { type AuditResult } from "@shared/schema";
import { RATING_LABEL, RATING_CLASS } from "@/lib/format";
import { useEffect, useState } from "react";

const STROKE = {
  good: "hsl(var(--good))",
  "needs-improvement": "hsl(var(--needs))",
  poor: "hsl(var(--poor))",
};

export function OverallScore({ result }: { result: AuditResult }) {
  const [display, setDisplay] = useState(0);
  const score = result.overallScore;
  const band = result.overallRating;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * score));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - display / 100);

  const passCount = Object.values(result.metrics).filter((m) => m.rating === "good").length;
  const total = Object.values(result.metrics).length;

  return (
    <div className="rounded-lg border border-card-border bg-card p-5 flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={STROKE[band]}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-extrabold tnum ${RATING_CLASS[band].text}`} data-testid="text-overall-score">
            {display}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">/ 100</span>
        </div>
      </div>
      <div className="flex-1 text-center sm:text-left">
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${RATING_CLASS[band].badge}`}>
          {RATING_LABEL[band]}
        </span>
        <p className="text-sm font-semibold mt-2">
          {passCount === total
            ? "All metrics pass"
            : `${passCount} of ${total} metrics in the good range`}
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Score = normalized weighted average of Lighthouse-weighted metrics present:
          FCP&nbsp;10%, LCP&nbsp;25%, TBT&nbsp;30%, CLS&nbsp;25% (Speed Index excluded; weights renormalized to 100).
          INP and TTFB are shown for diagnosis but excluded from the score. Bands: 0–49 poor, 50–89 needs improvement, 90–100 good.
        </p>
      </div>
    </div>
  );
}
