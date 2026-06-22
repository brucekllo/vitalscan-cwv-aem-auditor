import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { METRIC_ORDER, THRESHOLDS, type AuditResult, type MetricKey } from "@shared/schema";
import { formatMetric, RATING_CLASS, RATING_LABEL, formatTime, scoreBand } from "@/lib/format";
import { ArrowUpDown, Trash2, TrendingUp, Inbox, GitCompareArrows } from "lucide-react";

type SortKey = "url" | "timestamp" | "overallScore" | MetricKey;

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function TrendChart({ url, audits }: { url: string; audits: AuditResult[] }) {
  // Normalize each metric to its poor threshold so all six fit one axis (0-100%).
  const data = audits.map((a) => {
    const row: Record<string, number | string> = { t: formatTime(a.timestamp) };
    METRIC_ORDER.forEach((k) => {
      const max = THRESHOLDS[k].poor * 1.6;
      row[k] = Math.round((a.metrics[k].value / max) * 100);
      row[`${k}_raw`] = a.metrics[k].value;
    });
    return row;
  });

  return (
    <div className="rounded-2xl border border-card-border bg-card/92 p-4 shadow-dashboard" data-testid={`trend-${url}`}>
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold truncate">{url}</span>
        <span className="text-[10px] text-muted-foreground tnum">{audits.length} audits</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">
        Values normalized to each metric's poor threshold (lower is better).
      </p>
      <div className="rounded-xl bg-background/45 p-2" style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} hide={data.length > 6} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} unit="%" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--popover-border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(_v: number, name: string, p: any) => {
                const k = name as MetricKey;
                return [formatMetric(k, p.payload[`${k}_raw`]), k];
              }}
            />
            {METRIC_ORDER.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {METRIC_ORDER.map((k, i) => (
          <span key={k} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

export function History({
  history,
  onClear,
  onSelect,
}: {
  history: AuditResult[];
  onClear: () => void;
  onSelect: (a: AuditResult) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...history];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "url") {
        av = a.url;
        bv = b.url;
      } else if (sortKey === "timestamp" || sortKey === "overallScore") {
        av = a[sortKey];
        bv = b[sortKey];
      } else {
        av = a.metrics[sortKey].value;
        bv = b.metrics[sortKey].value;
      }
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [history, sortKey, asc]);

  // URLs audited more than once -> show trends.
  const repeatedUrls = useMemo(() => {
    const groups = new Map<string, AuditResult[]>();
    for (const a of history) {
      const arr = groups.get(a.url) || [];
      arr.push(a);
      groups.set(a.url, arr);
    }
    return Array.from(groups.entries())
      .filter(([, arr]) => arr.length > 1)
      .map(([url, arr]) => ({
        url,
        audits: [...arr].sort((x, y) => x.timestamp - y.timestamp),
      }));
  }, [history]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(false);
    }
  };

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-card-border bg-card/72 p-12 text-center shadow-dashboard">
        <div className="mx-auto mb-3 h-12 w-12 rounded-2xl border border-card-border bg-background/55 flex items-center justify-center">
          <Inbox className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <p className="text-base font-bold">No audits yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Run an audit on the Audit tab — results are saved here automatically.
        </p>
      </div>
    );
  }

  const Th = ({ k, label, num }: { k: SortKey; label: string; num?: boolean }) => (
    <th className={`px-3 py-2 font-semibold ${num ? "text-right" : "text-left"}`}>
      <button
        className="inline-flex items-center gap-1 hover:text-primary"
        onClick={() => toggleSort(k)}
        data-testid={`sort-${k}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? "text-primary" : "text-muted-foreground/40"}`} />
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          ["Audits", history.length],
          ["Unique URLs", new Set(history.map((h) => h.url)).size],
          ["Trend groups", repeatedUrls.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-card-border bg-card/92 p-4 shadow-dashboard">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
            <div className="mt-2 text-xl font-extrabold tnum">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-card-border bg-card/92 overflow-hidden shadow-dashboard">
        <div className="flex items-center justify-between px-4 py-3 border-b border-card-border bg-background/35">
          <div>
            <h2 className="font-bold text-sm">Audit history</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{history.length} saved result{history.length === 1 ? "" : "s"}</p>
          </div>
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-card-border bg-card hover-elevate"
            data-testid="button-clear-history"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/70 sticky top-0">
              <tr>
                <Th k="url" label="URL" />
                <Th k="timestamp" label="When" />
                <Th k="overallScore" label="Score" num />
                {METRIC_ORDER.map((k) => (
                  <Th key={k} k={k} label={k} num />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-card-border hover:bg-muted/35 cursor-pointer"
                  onClick={() => onSelect(a)}
                  data-testid={`row-audit-${a.id}`}
                >
                  <td className="px-3 py-2 max-w-[220px] truncate">{a.url}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatTime(a.timestamp)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`tnum font-bold ${RATING_CLASS[scoreBand(a.overallScore)].text}`}>
                      {a.overallScore}
                    </span>
                  </td>
                  {METRIC_ORDER.map((k) => (
                    <td key={k} className="px-3 py-2 text-right tnum">
                      <span className={RATING_CLASS[a.metrics[k].rating].text} title={RATING_LABEL[a.metrics[k].rating]}>
                        {formatMetric(k, a.metrics[k].value)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {repeatedUrls.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-primary" />
            <h2 className="font-bold text-sm">Repeated URL trends</h2>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            {repeatedUrls.map(({ url, audits }) => (
              <TrendChart key={url} url={url} audits={audits} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
