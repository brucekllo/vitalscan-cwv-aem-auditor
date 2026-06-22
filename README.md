# VitalScan — Core Web Vitals & AEM Performance Auditor

VitalScan is a fullstack web app that runs a fast, server-side performance audit of any
URL. It measures **TTFB** for real, inspects response headers and HTML, derives estimated
Core Web Vitals from deterministic heuristics, detects **Adobe Experience Manager (AEM)**,
and produces grouped optimization recommendations plus CDN tuning advice.

> **Estimated quick audit, not a lab Lighthouse trace.** The metric values (except TTFB)
> are derived from response headers and HTML heuristics so you get an instant, CORS-free
> read on any URL. For a true lab measurement, run Lighthouse or PageSpeed Insights — and
> the bundled Lighthouse CI does exactly that on every pull request.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS v3 + shadcn/ui + Recharts
- **Backend:** Express (Node) — fetches the target URL server-side (immune to browser CORS)
- **History:** browser `localStorage` via a safe wrapper with in-memory fallback
- **CI:** `@lhci/cli` (Lighthouse CI) + GitHub Actions

## Run locally

```bash
npm install
npm run dev      # Express + Vite on http://localhost:5000
```

Build and run the production server:

```bash
npm run build
npm start        # serves dist/public + API on PORT (default 5000)
```

Type-check:

```bash
npm run check
```

## How an audit works

1. You submit a URL. The backend (`POST /api/audit`) fetches it server-side with a mobile
   User-Agent. Because the fetch happens on the server, **CORS never blocks detection**.
2. **TTFB** is measured from request start to the moment the first response headers/bytes
   arrive. This is a real measurement.
3. The HTML and headers are parsed: scripts, stylesheets, images (and which lack
   dimensions), fonts, third-party origins, compression, `Cache-Control`, and `Server`.
4. The other five metrics are **estimated deterministically** from that evidence (seeded so
   repeated audits of the same URL are stable) and clearly labelled as an estimated quick
   audit.
5. Results are scored, rendered as color-coded scorecards and gauges, and saved to history.

## Interpreting each metric

All metrics share the rule **lower is better**. Ratings: 🟢 Good · 🟠 Needs Improvement · 🔴 Poor.

| Metric | What it measures | Good | Needs Improvement | Poor |
| --- | --- | --- | --- | --- |
| **LCP** — Largest Contentful Paint | Time until the largest above-the-fold element renders | ≤ 2500 ms | > 2500 and ≤ 4000 ms | > 4000 ms |
| **CLS** — Cumulative Layout Shift | Visual stability (unitless score) | ≤ 0.1 | > 0.1 and ≤ 0.25 | > 0.25 |
| **INP** — Interaction to Next Paint | Responsiveness to user input | ≤ 200 ms | > 200 and ≤ 500 ms | > 500 ms |
| **TBT** — Total Blocking Time | Main-thread blocking during load (Lighthouse mobile) | 0–200 ms | > 200 and ≤ 600 ms | > 600 ms |
| **FCP** — First Contentful Paint | Time until the first content paints | ≤ 1800 ms | > 1800 and ≤ 3000 ms | > 3000 ms |
| **TTFB** — Time to First Byte | Server response latency | ≤ 800 ms | > 800 and ≤ 1800 ms | > 1800 ms |

### Notes on FCP and TTFB thresholds

- **FCP:** web.dev explicitly states the **1.8s good target** measured at the **75th
  percentile** of page loads (segmented across mobile and desktop). The **3.0s poor** band
  is a Lighthouse / Web Vitals companion band, not a separate web.dev "good" statement.
- **TTFB:** web.dev explicitly states the **0.8s good target** at the **75th percentile**.
  The **1.8s poor** band is likewise a Lighthouse / Web Vitals companion band.

### Overall performance score (0–100)

The score is the **normalized weighted average of the Lighthouse-weighted metrics present**.
Lighthouse 10 weights are FCP 10%, LCP 25%, TBT 30%, CLS 25% (Speed Index is also 10% in
Lighthouse but is **not requested** here, so it is excluded and the remaining weights are
renormalized to 100). **INP and TTFB are displayed for diagnosis but do not contribute to
the score**; the in-app scorecard states this rule explicitly.

Score bands follow Lighthouse color ranges: **0–49 Poor**, **50–89 Needs Improvement**,
**90–100 Good**.

## Official threshold citations (plain URLs)

- LCP — https://web.dev/articles/lcp
- CLS — https://web.dev/articles/cls
- INP — https://web.dev/articles/inp
- FCP — https://web.dev/articles/fcp
- TTFB — https://web.dev/articles/ttfb
- TBT (Lighthouse mobile color-coding) — https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time
- Lighthouse performance scoring & weights — https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
- Core Web Vitals overview — https://web.dev/articles/vitals

## AEM detection

VitalScan flags Adobe Experience Manager when any of these signals are present:

- `/content/` or `/etc.clientlibs/` in asset URLs
- A Dispatcher or AEM signature in response headers
- A `.model.json` reference (SPA Editor / Sling Model exporter)
- Granite UI / `cq:` namespace / Core Component (`data-cmp-`) patterns in the HTML

When detected, an **AEM Optimization Tips** panel covers Dispatcher cache TTL/Cache-Control,
ClientLib bundling/minification, lazy loading of the Image/Teaser Core Components, Sling
Model caching/`adaptTo` notes, and CDN integration tips for Akamai/Fastly with Dispatcher.

## CDN recommendations

Driven by TTFB and LCP ratings. Includes recommended `Cache-Control` values per asset type
(HTML, JS, CSS, images, fonts), Akamai SureRoute / Fastly shielding tips, copy-paste
preconnect/preload snippets, and an **ESI recommendation when TTFB is Poor**.

## Export

Every audit can be exported as a **styled HTML report** (metrics, recommendations, AEM tips,
CDN suggestions). The download is streamed by the backend with
`Content-Disposition: attachment` so it works even inside sandboxed preview iframes.

## How CI works

On every **pull request**, `.github/workflows/lighthouse-ci.yml`:

1. Checks out the repo, sets up Node 20, runs `npm ci`, and `npm run build`.
2. Installs `@lhci/cli` and runs `lhci autorun` against the built static app
   (`dist/public`) using the assertions in `lighthouserc.json`.
3. Parses the median Lighthouse run and posts a **score summary as a PR comment** via
   `actions/github-script` (updates the same comment on re-runs).
4. **Fails the job if thresholds are breached.**

`lighthouserc.json` asserts: **LCP < 2500 ms**, **CLS < 0.1**, **TBT < 200 ms**, and
**performance score > 0.8** (FCP < 1800 ms is a warning).

## Project layout

```
client/src/
  pages/Dashboard.tsx        # main UI: input, tabs, results
  components/                # MetricCard, OverallScore, Panels, History, Logo
  lib/storage.ts             # safe localStorage wrapper + in-memory fallback
  lib/recommendations.ts     # recommendation, CDN, and AEM-tip engines
  lib/report.ts              # styled HTML report builder + download
  lib/format.ts              # formatting + rating → class maps
server/routes.ts             # POST /api/audit, POST /api/report
shared/schema.ts             # thresholds, weights, scoring, types (single source of truth)
lighthouserc.json            # Lighthouse CI assertions
.github/workflows/           # lighthouse-ci.yml
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) to extend AEM detection rules, add metrics, or
change CI thresholds.
