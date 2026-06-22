import { THRESHOLDS, type AuditMetric, type MetricKey } from "@shared/schema";
import { formatMetric, formatThreshold, RATING_LABEL, RATING_CLASS } from "@/lib/format";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const ICON = {
  good: CheckCircle2,
  "needs-improvement": AlertTriangle,
  poor: XCircle,
};

const ACTION_LABEL = {
  good: "Monitor",
  "needs-improvement": "Tune next",
  poor: "Fix first",
};

// Gauge: lower is better. The track shows good | needs | poor zones; the marker
// sits at the metric's position on a scale ending at 2x the poor threshold.
function Gauge({ metric }: { metric: AuditMetric }) {
  const t = THRESHOLDS[metric.key];
  const max = t.poor * 1.6;
  const pct = (v: number) => Math.min(100, Math.max(0, (v / max) * 100));
  const goodPct = pct(t.good);
  const poorPct = pct(t.poor);
  const markerPct = pct(metric.value);

  return (
    <div className="mt-3" aria-hidden="true">
      <div className="relative h-2.5 rounded-full overflow-hidden bg-muted shadow-inner-soft">
        <div className="absolute inset-y-0 left-0 bg-good/35" style={{ width: `${goodPct}%` }} />
        <div
          className="absolute inset-y-0 bg-needs/35"
          style={{ left: `${goodPct}%`, width: `${poorPct - goodPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-poor/35"
          style={{ left: `${poorPct}%`, right: 0 }}
        />
      </div>
      <div className="relative h-3">
        <div
          className={`absolute top-0 -translate-x-1/2 h-4 w-1 rounded-full ring-2 ring-card ${RATING_CLASS[metric.rating].bar}`}
          style={{ left: `${markerPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground tnum -mt-1">
        <span>0</span>
        <span>good ≤ {formatThreshold(metric.key, t.good)}</span>
        <span>poor &gt; {formatThreshold(metric.key, t.poor)}</span>
      </div>
    </div>
  );
}

export function MetricCard({ metric }: { metric: AuditMetric }) {
  const t = THRESHOLDS[metric.key];
  const cls = RATING_CLASS[metric.rating];
  const Icon = ICON[metric.rating];
  return (
    <div
      className="metric-card-glow rounded-xl border border-card-border bg-card/92 p-4 flex flex-col shadow-dashboard transition-transform duration-200 hover:-translate-y-0.5"
      data-testid={`card-metric-${metric.key}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-tight">{t.label}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${cls.badge}`}>
              <Icon className="h-3 w-3" />
              {RATING_LABEL[metric.rating]}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{t.name}</div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-extrabold tnum leading-none ${cls.text}`} data-testid={`text-value-${metric.key}`}>
            {formatMetric(metric.key, metric.value)}
          </div>
          <div className="text-[10px] text-muted-foreground tnum mt-1">metric score {metric.score}</div>
        </div>
      </div>
      <Gauge metric={metric} />
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-card-border bg-background/45 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Action</span>
        <span className={`text-[11px] font-bold ${cls.text}`}>{ACTION_LABEL[metric.rating]}</span>
      </div>
    </div>
  );
}
