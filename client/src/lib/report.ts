import { THRESHOLDS, METRIC_ORDER, type AuditResult } from "@shared/schema";
import { buildRecommendations, buildCdnAdvice, CACHE_RULES, AEM_TIPS } from "./recommendations";
import { formatMetric, formatThreshold, RATING_LABEL, formatTime, formatBytes } from "./format";

const RATING_COLOR: Record<string, string> = {
  good: "#1f9d57",
  "needs-improvement": "#c8810b",
  poor: "#cc2b50",
};

export function buildReportHtml(r: AuditResult): string {
  const recs = buildRecommendations(r);
  const cdn = buildCdnAdvice(r);

  const metricRows = METRIC_ORDER.map((k) => {
    const m = r.metrics[k];
    const t = THRESHOLDS[k];
    return `<tr>
      <td><strong>${t.label}</strong><div class="sub">${t.name}</div></td>
      <td class="num">${formatMetric(k, m.value)}</td>
      <td><span class="pill" style="background:${RATING_COLOR[m.rating]}">${RATING_LABEL[m.rating]}</span></td>
      <td class="num">${m.score}</td>
      <td class="sub">Good ≤ ${formatThreshold(k, t.good)} · Poor &gt; ${formatThreshold(k, t.poor)}</td>
    </tr>`;
  }).join("");

  const recBlocks = (Object.keys(recs) as (keyof typeof recs)[])
    .filter((g) => recs[g].length)
    .map(
      (g) => `<div class="recgroup"><h3>${g}</h3><ul>${recs[g]
        .map((x) => `<li>${x.text} <span class="tag">${x.metrics.join(", ")}</span></li>`)
        .join("")}</ul></div>`,
    )
    .join("");

  const aemBlock = r.aemDetected
    ? `<section><h2>AEM Optimization Tips</h2>
        <p class="sub">Adobe Experience Manager signals detected on this page.</p>
        <ul>${r.aemSignals
          .filter((s) => s.detected)
          .map((s) => `<li><strong>${s.label}:</strong> ${s.detail}</li>`)
          .join("")}</ul>
        <table>${AEM_TIPS.map((t) => `<tr><td><strong>${t.area}</strong></td><td>${t.tip}</td></tr>`).join("")}</table>
      </section>`
    : `<section><h2>AEM Detection</h2><p class="sub">No Adobe Experience Manager signals detected.</p></section>`;

  const cacheTable = CACHE_RULES.map(
    (c) => `<tr><td><strong>${c.type}</strong></td><td class="mono">${c.cacheControl}</td><td class="sub">${c.note}</td></tr>`,
  ).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitalScan Report — ${r.url}</title>
<style>
  :root{--ink:#16202b;--mut:#5b6876;--line:#e3e8ee;--teal:#0a7681;}
  *{box-sizing:border-box}
  body{font-family:Inter,system-ui,sans-serif;color:var(--ink);margin:0;background:#f5f7f9;line-height:1.5}
  .wrap{max-width:920px;margin:0 auto;padding:40px 28px}
  header{display:flex;align-items:center;gap:14px;border-bottom:2px solid var(--ink);padding-bottom:18px;margin-bottom:24px}
  .logo{width:34px;height:34px;border-radius:8px;background:var(--teal);display:flex;align-items:center;justify-content:center}
  h1{font-size:20px;margin:0}
  h2{font-size:16px;margin:32px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
  h3{font-size:13px;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
  .meta{font-size:13px;color:var(--mut)}
  .score{display:flex;align-items:center;gap:18px;margin:18px 0;padding:18px;border:1px solid var(--line);border-radius:12px;background:#fff}
  .score .big{font-size:46px;font-weight:800;font-variant-numeric:tabular-nums}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13px}
  td,th{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
  .sub{color:var(--mut);font-size:12px}
  .mono{font-family:"JetBrains Mono",monospace;font-size:12px}
  .pill{color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
  .tag{background:#eef2f5;color:var(--mut);border-radius:4px;padding:1px 5px;font-size:11px;font-family:monospace}
  ul{margin:6px 0;padding-left:18px}li{margin:4px 0;font-size:13px}
  .recgroup{margin-bottom:8px}
  .badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;color:#fff;background:var(--teal)}
  footer{margin-top:34px;font-size:11px;color:var(--mut);border-top:1px solid var(--line);padding-top:12px}
  @media print{body{background:#fff}.wrap{padding:0}}
</style></head><body><div class="wrap">
<header>
  <div class="logo"><svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M6 20 L12 20 L15 9 L19 26 L22 14 L26 14" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
  <div><h1>VitalScan Performance Report</h1>
  <div class="meta">${r.url} · ${formatTime(r.timestamp)}</div></div>
</header>

<span class="badge">${r.estimated ? "Estimated quick audit — not a lab Lighthouse trace" : "Audit"}</span>

<div class="score">
  <div class="big" style="color:${RATING_COLOR[r.overallRating]}">${r.overallScore}</div>
  <div>
    <div style="font-weight:700">${RATING_LABEL[r.overallRating]}</div>
    <div class="sub">Performance score 0–100 · normalized weighted average of FCP (10%), LCP (25%), TBT (30%), CLS (25%)</div>
  </div>
</div>

<section><h2>Metrics</h2>
<table><tr><th>Metric</th><th class="num">Value</th><th>Rating</th><th class="num">Score</th><th>Thresholds</th></tr>${metricRows}</table>
</section>

<section><h2>Evidence</h2>
<table>
  <tr><td>Final URL</td><td class="mono">${r.finalUrl}</td></tr>
  <tr><td>HTTP status</td><td>${r.statusCode}</td></tr>
  <tr><td>Server</td><td>${r.server || "—"}</td></tr>
  <tr><td>HTML size</td><td>${formatBytes(r.htmlBytes)}</td></tr>
  <tr><td>Scripts / Stylesheets / Images / Fonts</td><td>${r.scriptCount} / ${r.stylesheetCount} / ${r.imageCount} / ${r.fontCount}</td></tr>
  <tr><td>Images missing dimensions</td><td>${r.imagesMissingDims}</td></tr>
  <tr><td>Third-party origins</td><td>${r.thirdPartyCount}</td></tr>
  <tr><td>Compression</td><td>${r.hasCompression ? "Enabled" : "Not detected"}</td></tr>
  <tr><td>Cache-Control</td><td class="mono">${r.cacheControl || "—"}</td></tr>
</table>
</section>

<section><h2>Recommendations</h2>${recBlocks || '<p class="sub">All metrics are within the good range — no remediation needed.</p>'}</section>

${aemBlock}

<section><h2>CDN Recommendations</h2>
<p><strong>${cdn.headline}</strong></p>
<ul>${cdn.points.map((p) => `<li>${p}</li>`).join("")}</ul>
${cdn.recommendEsi ? '<p class="sub"><strong>ESI:</strong> TTFB is poor — use Edge Side Includes to cache the static shell while assembling dynamic fragments at the edge.</p>' : ""}
<h3>Cache-Control by asset type</h3>
<table>${cacheTable}</table>
</section>

<footer>Generated by VitalScan. Estimated quick audit derived from response headers and HTML heuristics; for a lab trace run Lighthouse / PageSpeed Insights. Thresholds: web.dev &amp; Chrome for Developers.</footer>
</div></body></html>`;
}

// Download the report. Uses a backend round-trip so it works inside the
// sandboxed deploy iframe (where blob/anchor downloads are blocked); falls back
// to a blob download locally.
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export function downloadReport(r: AuditResult) {
  const html = buildReportHtml(r);
  try {
    const form = document.createElement("form");
    form.method = "POST";
    form.target = "_blank";
    form.action = `${API_BASE}/api/report`;
    form.style.display = "none";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "html";
    input.value = encodeURIComponent(html);
    const nameInput = document.createElement("input");
    nameInput.type = "hidden";
    nameInput.name = "filename";
    nameInput.value = reportFilename(r);
    form.appendChild(input);
    form.appendChild(nameInput);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  } catch {
    // Local fallback
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFilename(r);
    a.click();
    URL.revokeObjectURL(url);
  }
}

function reportFilename(r: AuditResult): string {
  let host = "report";
  try {
    host = new URL(r.finalUrl).hostname;
  } catch {}
  return `vitalscan-${host}-${new Date(r.timestamp).toISOString().slice(0, 10)}.html`;
}
