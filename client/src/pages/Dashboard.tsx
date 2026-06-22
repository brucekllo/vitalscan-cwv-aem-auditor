import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { METRIC_ORDER, type AuditResult } from "@shared/schema";
import { Logo } from "@/components/Logo";
import { MetricCard } from "@/components/MetricCard";
import { OverallScore } from "@/components/OverallScore";
import { RecommendationsPanel, AemPanel, CdnPanel } from "@/components/Panels";
import { History } from "@/components/History";
import { loadHistory, saveAudit, clearHistory, isMemoryFallback } from "@/lib/storage";
import { downloadReport } from "@/lib/report";
import { formatBytes } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Loader2,
  Download,
  Moon,
  Sun,
  Gauge as GaugeIcon,
  History as HistoryIcon,
  AlertCircle,
  Info,
} from "lucide-react";

function useTheme() {
  const [dark, setDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true,
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

const EXAMPLES = ["https://www.adobe.com", "https://web.dev", "https://wikipedia.org"];

export default function Dashboard() {
  const { dark, toggle } = useTheme();
  const { toast } = useToast();
  const [tab, setTab] = useState<"audit" | "history">("audit");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [history, setHistory] = useState<AuditResult[]>([]);
  const [memoryWarned, setMemoryWarned] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (isMemoryFallback()) setMemoryWarned(true);
  }, []);

  const audit = useMutation({
    mutationFn: async (target: string) => {
      const res = await apiRequest("POST", "/api/audit", { url: target });
      return (await res.json()) as AuditResult;
    },
    onSuccess: (data) => {
      setResult(data);
      const updated = saveAudit(data);
      setHistory(updated);
    },
    onError: (err: any) => {
      toast({
        title: "Audit failed",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  const run = (target?: string) => {
    const t = (target ?? url).trim();
    if (!t) {
      toast({ title: "Enter a URL", description: "Type a website URL to audit." });
      return;
    }
    if (target) setUrl(target);
    audit.mutate(t);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Logo />
          <nav className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setTab("audit")}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md ${tab === "audit" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-audit"
            >
              <GaugeIcon className="h-3.5 w-3.5" />
              Audit
            </button>
            <button
              onClick={() => setTab("history")}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md ${tab === "history" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-history"
            >
              <HistoryIcon className="h-3.5 w-3.5" />
              History
              {history.length > 0 && (
                <span className="tnum text-[10px] bg-primary/15 text-primary rounded-full px-1.5">
                  {history.length}
                </span>
              )}
            </button>
          </nav>
          <button
            onClick={toggle}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border hover-elevate"
            aria-label="Toggle theme"
            data-testid="button-theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* URL input bar */}
        <div className="rounded-lg border border-card-border bg-card p-4 mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                inputMode="url"
                className="w-full h-11 pl-9 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="input-url"
              />
            </div>
            <button
              type="submit"
              disabled={audit.isPending}
              className="h-11 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 hover-elevate active-elevate-2"
              data-testid="button-run-audit"
            >
              {audit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {audit.isPending ? "Auditing…" : "Run Audit"}
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => run(ex)}
                className="font-mono text-[11px] px-2 py-0.5 rounded border border-card-border hover-elevate"
                data-testid={`example-${ex}`}
              >
                {ex.replace("https://", "")}
              </button>
            ))}
          </div>
        </div>

        {memoryWarned && (
          <div className="flex items-center gap-2 text-xs text-needs mb-4 rounded-md border border-needs/40 bg-needs-soft px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Browser storage is blocked here — history is kept in memory only for this session.
          </div>
        )}

        {tab === "audit" && (
          <>
            {audit.isPending && <LoadingSkeleton />}

            {!audit.isPending && !result && <EmptyState />}

            {!audit.isPending && result && (
              <div className="space-y-6">
                {/* Estimate banner */}
                <div className="flex items-start gap-2 text-xs rounded-md border border-primary/30 bg-accent/40 px-3 py-2">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Estimated quick audit</strong> for{" "}
                    <span className="font-mono">{result.finalUrl}</span> — values are derived from
                    server-side response headers and HTML heuristics, not a lab Lighthouse trace.
                    TTFB is a real server-side measurement. For a lab trace, run Lighthouse or
                    PageSpeed Insights.
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h1 className="text-base font-semibold">Audit result</h1>
                  <button
                    onClick={() => downloadReport(result)}
                    className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-md border border-card-border hover-elevate"
                    data-testid="button-export"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Report
                  </button>
                </div>

                <OverallScore result={result} />

                {/* Scorecards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {METRIC_ORDER.map((k) => (
                    <MetricCard key={k} metric={result.metrics[k]} />
                  ))}
                </div>

                <EvidenceStrip result={result} />
                <RecommendationsPanel result={result} />
                <AemPanel result={result} />
                <CdnPanel result={result} />
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <History
            history={history}
            onClear={() => {
              clearHistory();
              setHistory([]);
            }}
            onSelect={(a) => {
              setResult(a);
              setTab("audit");
            }}
          />
        )}
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>
            VitalScan — estimated quick audit. Thresholds:{" "}
            <a href="https://web.dev/articles/vitals" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              web.dev
            </a>{" "}
            &amp;{" "}
            <a
              href="https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Chrome for Developers
            </a>
            .
          </span>
          <span>Lower is better for all metrics.</span>
        </div>
      </footer>
    </div>
  );
}

function EvidenceStrip({ result }: { result: AuditResult }) {
  const items: [string, string][] = [
    ["HTTP", String(result.statusCode || "—")],
    ["Server", result.server || "—"],
    ["HTML size", formatBytes(result.htmlBytes)],
    ["Scripts", String(result.scriptCount)],
    ["Stylesheets", String(result.stylesheetCount)],
    ["Images", String(result.imageCount)],
    ["No dimensions", String(result.imagesMissingDims)],
    ["Fonts", String(result.fontCount)],
    ["3rd-party", String(result.thirdPartyCount)],
    ["Compression", result.hasCompression ? "On" : "Off"],
  ];
  return (
    <div className="rounded-lg border border-card-border bg-card p-4">
      <h2 className="font-semibold text-sm mb-3">Page evidence</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-y-3 gap-x-4">
        {items.map(([label, val]) => (
          <div key={label}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-sm font-semibold tnum truncate">{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-card-border bg-card p-12 text-center">
      <GaugeIcon className="h-10 w-10 mx-auto text-primary/40 mb-3" />
      <p className="text-sm font-medium">Audit a URL to begin</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
        VitalScan fetches the page server-side, measures TTFB, inspects headers and HTML,
        detects AEM, and scores Core Web Vitals with grouped recommendations.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-32 rounded-lg bg-muted" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-40 rounded-lg bg-muted" />
    </div>
  );
}
