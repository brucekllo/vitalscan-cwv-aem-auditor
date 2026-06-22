import type { AuditResult, MetricKey, RatingKey } from "@shared/schema";

export type RecGroup = "Images" | "JavaScript" | "CSS" | "Fonts" | "Server/CDN";

export interface Recommendation {
  group: RecGroup;
  text: string;
  metrics: MetricKey[];
}

export const REC_GROUPS: RecGroup[] = ["Images", "JavaScript", "CSS", "Fonts", "Server/CDN"];

// Returns grouped recommendations for every metric that is Needs Improvement
// or Poor, de-duplicated by text.
export function buildRecommendations(result: AuditResult): Record<RecGroup, Recommendation[]> {
  const out: Record<RecGroup, Recommendation[]> = {
    Images: [],
    JavaScript: [],
    CSS: [],
    Fonts: [],
    "Server/CDN": [],
  };
  const seen = new Set<string>();
  const add = (group: RecGroup, text: string, metrics: MetricKey[]) => {
    const dupKey = group + "|" + text;
    if (seen.has(dupKey)) return;
    seen.add(dupKey);
    out[group].push({ group, text, metrics });
  };

  const bad = (k: MetricKey): boolean => result.metrics[k].rating !== "good";

  if (bad("LCP")) {
    add("Images", "Preload the LCP image and serve it as AVIF/WebP at the rendered size.", ["LCP"]);
    add("Images", "Add explicit width/height (or aspect-ratio) so the hero image reserves space.", ["LCP"]);
    add("Server/CDN", "Cut TTFB on the document so the LCP element can paint sooner.", ["LCP"]);
    add("CSS", "Inline critical CSS and defer the rest to remove render-blocking before LCP.", ["LCP"]);
  }
  if (bad("CLS")) {
    add("Images", `Set dimensions on images — ${result.imagesMissingDims} image(s) currently lack width/height.`, ["CLS"]);
    add("Fonts", "Use font-display: optional/swap with a matched fallback to avoid layout reflow.", ["CLS"]);
    add("CSS", "Reserve space for banners, embeds, and ads with min-height to stop shifting.", ["CLS"]);
  }
  if (bad("INP")) {
    add("JavaScript", "Break up long tasks with yielding (scheduler.yield / setTimeout) to keep input responsive.", ["INP"]);
    add("JavaScript", "Debounce expensive handlers and move non-urgent work off the main thread (Web Workers).", ["INP"]);
  }
  if (bad("TBT")) {
    add("JavaScript", "Code-split and lazy-load JS; remove unused bundles to shrink main-thread work.", ["TBT"]);
    add("JavaScript", `Defer or async non-critical scripts — ${result.scriptCount} script(s) detected.`, ["TBT"]);
    add("JavaScript", `Reduce third-party JS — ${result.thirdPartyCount} third-party origin(s) detected.`, ["TBT"]);
  }
  if (bad("FCP")) {
    add("CSS", `Minify and bundle stylesheets — ${result.stylesheetCount} stylesheet(s) found; eliminate render-blocking CSS.`, ["FCP"]);
    add("Server/CDN", "Enable text compression (Brotli/Gzip) and HTTP/2+ to speed first paint.", ["FCP", "TTFB"]);
    add("Fonts", "Preconnect to font origins and preload key web fonts to avoid invisible text.", ["FCP"]);
  }
  if (bad("TTFB")) {
    add("Server/CDN", "Serve cached HTML from a CDN edge close to users; add full-page caching.", ["TTFB"]);
    add("Server/CDN", "Tune origin: connection pooling, DB query caching, and keep-alive.", ["TTFB"]);
  }
  if (!result.hasCompression) {
    add("Server/CDN", "Response is not compressed — enable Brotli or Gzip on text assets.", ["FCP", "LCP"]);
  }
  if (result.fontCount > 2) {
    add("Fonts", `Subset and self-host fonts — ${result.fontCount} font resource(s) detected.`, ["FCP", "LCP"]);
  }
  return out;
}

// ---- CDN recommendation engine -------------------------------------------

export interface CacheRule {
  type: string;
  cacheControl: string;
  note: string;
}

export const CACHE_RULES: CacheRule[] = [
  { type: "HTML", cacheControl: "Cache-Control: no-cache, must-revalidate", note: "Revalidate on each request; CDN may cache with short s-maxage + SWR." },
  { type: "JS", cacheControl: "Cache-Control: public, max-age=31536000, immutable", note: "Fingerprint filenames (app.[hash].js) so this is safe." },
  { type: "CSS", cacheControl: "Cache-Control: public, max-age=31536000, immutable", note: "Fingerprinted CSS can be cached for a year." },
  { type: "Images", cacheControl: "Cache-Control: public, max-age=2592000, stale-while-revalidate=86400", note: "30-day cache; SWR keeps edges warm." },
  { type: "Fonts", cacheControl: "Cache-Control: public, max-age=31536000, immutable", note: "Fonts rarely change; add crossorigin on the preload." },
];

export interface CdnAdvice {
  severity: RatingKey;
  headline: string;
  points: string[];
  recommendEsi: boolean;
  preconnectSnippet: string;
  prefetchSnippet: string;
}

export function buildCdnAdvice(result: AuditResult): CdnAdvice {
  const ttfb = result.metrics.TTFB;
  const lcp = result.metrics.LCP;
  const worst: RatingKey =
    ttfb.rating === "poor" || lcp.rating === "poor"
      ? "poor"
      : ttfb.rating !== "good" || lcp.rating !== "good"
        ? "needs-improvement"
        : "good";

  const points: string[] = [];
  if (ttfb.rating !== "good") {
    points.push("High TTFB points to origin latency — front the origin with a CDN and cache HTML at the edge.");
    points.push("Akamai: enable SureRoute to optimize the origin-fetch path over the best-performing route.");
    points.push("Fastly: enable Origin Shielding so a single shield POP absorbs origin fetches and raises hit ratio.");
  } else {
    points.push("TTFB is healthy — keep edge caching and revalidation policies as they are.");
  }
  if (lcp.rating !== "good") {
    points.push("Offload and resize the LCP image at the edge (image optimization / Image Manager).");
    points.push("Use HTTP/2 or HTTP/3 (QUIC) at the edge to parallelize critical resource delivery.");
  }
  if (worst === "good") {
    points.push("Field performance is good; monitor 75th-percentile CrUX to catch regressions.");
  }

  const host = (() => {
    try {
      return new URL(result.finalUrl).origin;
    } catch {
      return result.url;
    }
  })();

  return {
    severity: worst,
    headline:
      worst === "poor"
        ? "Origin delivery is slow — add a CDN edge and caching layer now."
        : worst === "needs-improvement"
          ? "Edge delivery can be tightened to hit good thresholds."
          : "Delivery looks good — maintain current edge configuration.",
    points,
    recommendEsi: ttfb.rating === "poor",
    preconnectSnippet: `<link rel="preconnect" href="${host}" crossorigin>
<link rel="dns-prefetch" href="${host}">`,
    prefetchSnippet: `<link rel="preload" as="image" href="/path/to/lcp-image.avif" fetchpriority="high">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
  };
}

// ---- AEM optimization tips -------------------------------------------------

export interface AemTip {
  area: string;
  tip: string;
}

export const AEM_TIPS: AemTip[] = [
  { area: "Dispatcher cache", tip: "Set sensible TTLs and emit Cache-Control on cacheable paths; flush selectively on publish via the Dispatcher invalidation handler." },
  { area: "ClientLibs", tip: "Bundle and minify ClientLibraries (allowProxy, minify, gzip) and split critical vs. deferred categories to cut render-blocking JS/CSS." },
  { area: "Core Components", tip: "Enable lazy loading on the Image and Teaser Core Components and use the adaptive image servlet (NGDM) for responsive, right-sized images." },
  { area: "Sling Models", tip: "Cache expensive Sling Model logic; prefer @PostConstruct memoization and request-scoped adaptTo() over repeated resource resolution." },
  { area: "CDN integration", tip: "Front the Dispatcher with Akamai or Fastly; honor Dispatcher Cache-Control at the edge and shield the Dispatcher with a single POP for a higher hit ratio." },
];
