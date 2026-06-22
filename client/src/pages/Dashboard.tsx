import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { METRIC_ORDER, type AuditResult, type MetricKey } from "@shared/schema";
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
  Zap,
  Radar,
  Database,
  FileText,
  ArrowRight,
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
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

const METRIC_CATEGORY: Record<MetricKey, string> = {
  LCP: "Loading",
  CLS: "Stability",
  INP: "Responsiveness",
  TBT: "JavaScript",
  FCP: "Render path",
  TTFB: "Server/CDN",
};

const FIX_HINT: Record<MetricKey, string> = {
  LCP: "Prioritize hero image, critical CSS, and cacheable HTML.",
  CLS: "Reserve media/ad slots and avoid late layout injection.",
  INP: "Break long handlers and reduce main-thread contention.",
  TBT: "Split bundles, defer non-critical scripts, and trim third-party JS.",
  FCP: "Remove render-blocking CSS and preload critical assets.",
  TTFB: "Tune origin response, edge cache, redirects, and shielding.",
};

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
    <div className="app-shell min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/78 backdrop-blur-xl supports-[backdrop-filter]:bg-background/68">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden sm:flex items-center gap-1 rounded-full border border-card-border bg-card/70 p-1 shadow-sm">
            <button
              onClick={() => setTab("audit")}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full ${tab === "audit" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/70"}`}
              data-testid="tab-audit"
            >
              <GaugeIcon className="h-3.5 w-3.5" />
              Audit
            </button>
            <button
              onClick={() => setTab("history")}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full ${tab === "history" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/70"}`}
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
          <div className="sm:hidden flex items-center gap-1 rounded-full border border-card-border bg-card/70 p-1">
            <button
              onClick={() => setTab("audit")}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-full ${tab === "audit" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-label="Audit"
              data-testid="tab-audit-mobile"
            >
              <GaugeIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTab("history")}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-full ${tab === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-label="History"
              data-testid="tab-history-mobile"
            >
              <HistoryIcon className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={toggle}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-card-border bg-card/70 shadow-sm hover-elevate"
            aria-label="Toggle theme"
            data-testid="button-theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7 sm:py-10">
        <section className="relative overflow-hidden rounded-2xl border border-card-border bg-card/88 shadow-dashboard mb-6">
          <div className="hero-grid absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/18 blur-3xl" aria-hidden="true" />
          <div className="absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-chart-3/10 blur-3xl" aria-hidden="true" />
          <div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-6 p-5 sm:p-7 lg:p-8">
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  <Radar className="h-3.5 w-3.5" />
                  Web Performance Intelligence
                </div>
                <h1 className="mt-4 max-w-2xl text-xl font-bold tracking-tight">
                  Audit Core Web Vitals, AEM signals, and CDN readiness in one fast pass.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Enter a page URL to run a server-side quick audit with real TTFB measurement,
                  deterministic CWV estimates, AEM fingerprinting, and remediation guidance ready
                  for engineering handoff.
                </p>
              </div>

              {/* URL input bar */}
              <div className="rounded-xl border border-card-border bg-background/72 p-3 sm:p-4 shadow-inner-soft">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run();
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com"
                      inputMode="url"
                      className="w-full h-12 pl-11 pr-3 rounded-lg border border-input bg-card/92 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      data-testid="input-url"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={audit.isPending}
                    className="h-12 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 hover-elevate active-elevate-2 shadow-sm"
                    data-testid="button-run-audit"
                  >
                    {audit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {audit.isPending ? "Auditing…" : "Run Audit"}
                    {!audit.isPending && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span className="font-medium">Try</span>
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => run(ex)}
                      className="font-mono text-[11px] px-2.5 py-1 rounded-full border border-card-border bg-card/80 hover-elevate"
                      data-testid={`example-${ex}`}
                    >
                      {ex.replace("https://", "")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <HeroHighlights historyCount={history.length} result={result} />
          </div>
        </section>

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
                <div className="flex items-start gap-2 text-xs rounded-xl border border-primary/30 bg-accent/45 px-4 py-3 shadow-sm">
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
                  <div>
                    <h2 className="text-base font-bold">Audit result</h2>
                    <p className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-[72ch]">{result.finalUrl}</p>
                  </div>
                  <button
                    onClick={() => downloadReport(result)}
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-full border border-card-border bg-card hover-elevate"
                    data-testid="button-export"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Report
                  </button>
                </div>

                <OverallScore result={result} />
                <ExecutiveSummary result={result} onOpenHistory={() => setTab("history")} />

                {/* Scorecards */}
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
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

      <footer className="border-t border-border bg-background/72 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
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

function HeroHighlights({ historyCount, result }: { historyCount: number; result: AuditResult | null }) {
  const cards = [
    { label: "Metrics", value: "6", detail: "CWV + diagnostics", icon: GaugeIcon },
    { label: "Detection", value: "AEM", detail: "headers + source", icon: FileText },
    { label: "History", value: String(historyCount), detail: "saved audits", icon: Database },
    { label: "Mode", value: result?.estimated ? "Quick" : "Ready", detail: "server-side scan", icon: Zap },
  ];

  return (
    <aside className="grid grid-cols-2 gap-3 content-start">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-xl border border-card-border bg-background/62 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{card.label}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-lg font-extrabold tnum">{card.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{card.detail}</div>
          </div>
        );
      })}
      <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Zap className="h-4 w-4" />
          Optimized for AEM teams
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Dispatcher cache, ClientLib, Core Component, Sling Model, and Akamai/Fastly guidance appears automatically when signals match.
        </p>
      </div>
    </aside>
  );
}

function ExecutiveSummary({
  result,
  onOpenHistory,
}: {
  result: AuditResult;
  onOpenHistory: () => void;
}) {
  const problemMetrics = METRIC_ORDER.map((key) => result.metrics[key]).filter((m) => m.rating !== "good");
  const topIssues = [...problemMetrics].sort((a, b) => a.score - b.score).slice(0, 3);
  const goodCount = METRIC_ORDER.length - problemMetrics.length;
  const StatusIcon =
    result.overallRating === "good"
      ? CheckCircle2
      : result.overallRating === "poor"
        ? XCircle
        : AlertTriangle;
  const headline =
    result.overallRating === "good"
      ? "Performance posture is healthy"
      : result.overallRating === "poor"
        ? "Prioritize remediation before release"
        : "Targeted tuning should lift this page";

  return (
    <section className="grid lg:grid-cols-[0.85fr_1.15fr] gap-4">
      <div className="rounded-2xl border border-card-border bg-card/92 p-5 shadow-dashboard">
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
            <StatusIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold">{headline}</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {goodCount} metrics are good, {problemMetrics.length} need attention. Use this as a triage view before diving into the detailed recommendations below.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Good", goodCount, "text-good"],
            ["Review", problemMetrics.filter((m) => m.rating === "needs-improvement").length, "text-needs"],
            ["Poor", problemMetrics.filter((m) => m.rating === "poor").length, "text-poor"],
          ].map(([label, value, cls]) => (
            <div key={label} className="rounded-xl border border-card-border bg-background/55 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className={`text-lg font-extrabold tnum ${cls}`}>{value}</div>
            </div>
          ))}
        </div>
        <button
          onClick={onOpenHistory}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full border border-card-border bg-background/55 px-3 py-2 text-xs font-semibold hover-elevate"
          data-testid="button-open-history-summary"
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          Compare in History
        </button>
      </div>

      <div className="rounded-2xl border border-card-border bg-card/92 p-5 shadow-dashboard">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold">Priority fixes</h2>
            <p className="text-xs text-muted-foreground mt-1">Top issues ranked by metric score impact.</p>
          </div>
          <Target className="h-4 w-4 text-primary" />
        </div>
        {topIssues.length === 0 ? (
          <div className="rounded-xl border border-good/25 bg-good-soft p-4 text-sm">
            <span className="font-semibold text-good">No priority fixes.</span>{" "}
            Keep monitoring regressions through History and Lighthouse CI.
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {topIssues.map((metric, index) => (
              <div key={metric.key} className="rounded-xl border border-card-border bg-background/55 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">P{index + 1}</span>
                  <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{METRIC_CATEGORY[metric.key]}</span>
                </div>
                <div className="mt-2 text-sm font-extrabold">{metric.key}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{FIX_HINT[metric.key]}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
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
    <div className="rounded-xl border border-card-border bg-card/92 p-5 shadow-dashboard">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-sm">Page evidence</h2>
          <p className="text-xs text-muted-foreground mt-1">Signals captured from response headers and HTML source.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {items.map(([label, val]) => (
          <div key={label} className="rounded-lg border border-card-border bg-background/55 px-3 py-2">
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
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-card-border bg-card/72 p-8 sm:p-12 text-center shadow-dashboard">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" aria-hidden="true" />
      <div className="mx-auto mb-4 h-14 w-14 rounded-2xl border border-primary/25 bg-primary/10 flex items-center justify-center">
        <GaugeIcon className="h-7 w-7 text-primary" />
      </div>
      <p className="text-base font-bold">Ready for a fast performance scan</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
        Paste a URL above or choose a sample. VitalScan will measure TTFB, detect AEM fingerprints, estimate the key Web Vitals, and generate prioritized engineering fixes.
      </p>
      <div className="mt-6 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
        {[
          ["Measure", "Server-side fetch with response evidence"],
          ["Diagnose", "CWV scorecards and threshold gauges"],
          ["Act", "AEM, CDN, and asset recommendations"],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl border border-card-border bg-background/55 p-3">
            <div className="text-xs font-bold">{title}</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  const stages = [
    "Fetching response",
    "Measuring TTFB",
    "Scanning HTML",
    "Detecting AEM",
    "Building recommendations",
  ];
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-card-border bg-card/92 p-5 shadow-dashboard">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Audit in progress
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Server-side scan is collecting response evidence, estimating metrics, and preparing the report.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Typical time</div>
            <div className="text-sm font-bold tnum">5–15 s</div>
          </div>
        </div>
        <div className="mt-5 grid sm:grid-cols-5 gap-2">
          {stages.map((stage, index) => (
            <div key={stage} className="rounded-xl border border-card-border bg-background/55 p-3">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center text-[10px] font-bold">
                  {index + 1}
                </span>
                <span className="text-[11px] font-semibold">{stage}</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-2/3 rounded-full bg-primary animate-scan-progress" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/70" />
        ))}
      </div>
      <div className="h-44 rounded-2xl bg-muted/70 animate-pulse" />
    </div>
  );
}
