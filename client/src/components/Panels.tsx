import { useState } from "react";
import { type AuditResult } from "@shared/schema";
import {
  buildRecommendations,
  buildCdnAdvice,
  CACHE_RULES,
  AEM_TIPS,
  REC_GROUPS,
} from "@/lib/recommendations";
import { RATING_CLASS } from "@/lib/format";
import {
  Image as ImageIcon,
  Braces,
  Paintbrush,
  Type,
  Server,
  Copy,
  Check,
  ShieldCheck,
  Layers,
} from "lucide-react";

const GROUP_ICON = {
  Images: ImageIcon,
  JavaScript: Braces,
  CSS: Paintbrush,
  Fonts: Type,
  "Server/CDN": Server,
} as const;

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="text-[11px] leading-relaxed font-mono bg-muted/80 rounded-lg p-3 overflow-x-auto border border-card-border whitespace-pre-wrap break-all shadow-inner-soft">
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(code).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          );
        }}
        className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-card border border-card-border hover-elevate"
        data-testid="button-copy-snippet"
      >
        {copied ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function RecommendationsPanel({ result }: { result: AuditResult }) {
  const recs = buildRecommendations(result);
  const hasAny = REC_GROUPS.some((g) => recs[g].length > 0);

  if (!hasAny) {
    return (
      <div className="rounded-2xl border border-card-border bg-card/92 p-5 shadow-dashboard">
        <h2 className="font-bold text-sm mb-1">Recommendations</h2>
        <p className="text-sm text-muted-foreground">
          Every metric is in the good range. No remediation needed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card/92 p-5 shadow-dashboard">
      <h2 className="font-bold text-sm mb-1">Recommendations</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Grouped fixes for every metric rated Needs Improvement or Poor.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {REC_GROUPS.filter((g) => recs[g].length > 0).map((g) => {
          const Icon = GROUP_ICON[g];
          return (
            <div key={g} className="rounded-xl border border-card-border bg-background/45 p-4" data-testid={`recgroup-${g}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-bold text-sm">{g}</span>
                <span className="ml-auto text-[10px] text-muted-foreground tnum rounded-full bg-muted px-2 py-0.5">{recs[g].length}</span>
              </div>
              <ul className="space-y-2">
                {recs[g].map((r, i) => (
                  <li key={i} className="text-xs leading-relaxed flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>
                      {r.text}{" "}
                      {r.metrics.map((m) => (
                        <span
                          key={m}
                          className="inline-block text-[9px] font-mono bg-muted rounded px-1 py-0.5 ml-0.5 text-muted-foreground"
                        >
                          {m}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AemPanel({ result }: { result: AuditResult }) {
  if (!result.aemDetected) {
    return (
      <div className="rounded-2xl border border-card-border bg-card/92 p-5 shadow-dashboard">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-bold text-sm">AEM Detection</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          No Adobe Experience Manager signals detected on this page.
        </p>
        <ul className="mt-3 space-y-1">
          {result.aemSignals.map((s) => (
            <li key={s.label} className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-primary/35 bg-accent/45 p-5 shadow-dashboard">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="h-4 w-4 text-primary" />
        <h2 className="font-bold text-sm">AEM Optimization Tips</h2>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
          AEM Detected
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 my-3">
        {result.aemSignals.map((s) => (
          <div key={s.label} className="text-xs flex items-start gap-2 rounded-lg border border-primary/10 bg-background/35 p-2.5">
            <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${s.detected ? "bg-good" : "bg-muted-foreground/40"}`} />
            <span>
              <span className="font-medium">{s.label}</span>
              <span className="block text-muted-foreground">{s.detail}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-2 mt-4">
        {AEM_TIPS.map((t) => (
          <div key={t.area} className="text-xs leading-relaxed">
            <span className="font-semibold text-primary">{t.area}: </span>
            <span>{t.tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CdnPanel({ result }: { result: AuditResult }) {
  const cdn = buildCdnAdvice(result);
  const cls = RATING_CLASS[cdn.severity];
  return (
    <div className="rounded-2xl border border-card-border bg-card/92 p-5 shadow-dashboard">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="font-bold text-sm">CDN Recommendations</h2>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls.badge}`}>
          {cdn.severity === "good" ? "Healthy" : cdn.severity === "poor" ? "Action needed" : "Tune"}
        </span>
      </div>
      <p className="text-sm font-medium mb-2">{cdn.headline}</p>
      <ul className="space-y-1.5 mb-4">
        {cdn.points.map((p, i) => (
          <li key={i} className="text-xs leading-relaxed flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      {cdn.recommendEsi && (
        <div className="text-xs rounded-xl border border-poor/40 bg-poor-soft p-3 mb-4">
          <span className="font-semibold text-poor">ESI recommended: </span>
          TTFB is Poor — use Edge Side Includes to cache the static shell while assembling
          dynamic fragments at the edge, so most requests skip the origin.
        </div>
      )}

      <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
        Cache-Control by asset type
      </h3>
      <div className="overflow-x-auto rounded-xl border border-card-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/70 text-left">
              <th className="px-3 py-2 font-semibold">Asset</th>
              <th className="px-3 py-2 font-semibold">Cache-Control</th>
              <th className="px-3 py-2 font-semibold hidden sm:table-cell">Note</th>
            </tr>
          </thead>
          <tbody>
            {CACHE_RULES.map((c) => (
              <tr key={c.type} className="border-t border-card-border">
                <td className="px-3 py-2 font-medium">{c.type}</td>
                <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{c.cacheControl}</td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <div>
          <h3 className="text-xs font-semibold mb-1.5 uppercase tracking-wide text-muted-foreground">
            Preconnect / DNS-prefetch
          </h3>
          <CopyBlock code={cdn.preconnectSnippet} />
        </div>
        <div>
          <h3 className="text-xs font-semibold mb-1.5 uppercase tracking-wide text-muted-foreground">
            Preload critical resources
          </h3>
          <CopyBlock code={cdn.prefetchSnippet} />
        </div>
      </div>
    </div>
  );
}
