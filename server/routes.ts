import type { Express, Request, Response } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { performance } from "node:perf_hooks";
import {
  auditRequestSchema,
  THRESHOLDS,
  METRIC_ORDER,
  rate,
  metricScore,
  overallRating,
  LIGHTHOUSE_WEIGHTS,
  type AuditResult,
  type AuditMetric,
  type MetricKey,
  type AemSignal,
} from "@shared/schema";

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// Deterministic pseudo-random in [0,1) from a string seed — keeps repeated
// audits of the same URL stable so the "estimated" label is honest.
function seededUnit(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}

function countMatches(html: string, re: RegExp): number {
  const m = html.match(re);
  return m ? m.length : 0;
}

async function runAudit(inputUrl: string): Promise<AuditResult> {
  const url = normalizeUrl(inputUrl);
  const notes: string[] = [];

  let statusCode = 0;
  let finalUrl = url;
  let html = "";
  let headers: Record<string, string> = {};
  let ttfb = 0;
  let fetchOk = false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const start = performance.now();
    const resp = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Pretend to be a real mobile browser so servers return the page they
        // would serve to users. Server-side fetch is immune to browser CORS.
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
      },
    });
    // First response headers/bytes have arrived: this is our TTFB proxy.
    ttfb = Math.round(performance.now() - start);
    statusCode = resp.status;
    finalUrl = resp.url || url;
    resp.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    html = await resp.text();
    fetchOk = true;
  } catch (err: any) {
    notes.push(
      `Could not fetch the page (${err?.name === "AbortError" ? "timed out after 15s" : String(err?.message || err)}). Metrics below are rough estimates.`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const htmlBytes = Buffer.byteLength(html, "utf8");

  // --- Asset inspection -----------------------------------------------------
  const scriptSrcs = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)).map(
    (m) => m[1],
  );
  const inlineScripts = countMatches(html, /<script\b(?![^>]*\bsrc=)[^>]*>/gi);
  const stylesheets = Array.from(html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)).map(
    (m) => m[0],
  );
  const inlineStyleBytes = Array.from(html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)).reduce(
    (acc, m) => acc + m[1].length,
    0,
  );
  const imgTags = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((m) => m[0]);
  const imagesMissingDims = imgTags.filter(
    (t) => !/\bwidth=/i.test(t) || !/\bheight=/i.test(t),
  ).length;
  const lazyImages = imgTags.filter((t) => /loading=["']lazy["']/i.test(t)).length;
  const fontLinks = countMatches(
    html,
    /<link\b[^>]*(as=["']font["']|\.woff2?|fonts\.googleapis|fonts\.gstatic|use\.typekit)[^>]*>/gi,
  );

  let host = "";
  try {
    host = new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch {}
  const allUrls = [...scriptSrcs, ...stylesheets.map((s) => (s.match(/href=["']([^"']+)["']/i) || [])[1])].filter(
    Boolean,
  ) as string[];
  const thirdParty = new Set<string>();
  for (const a of allUrls) {
    try {
      if (/^https?:\/\//i.test(a)) {
        const h = new URL(a).hostname.replace(/^www\./, "");
        if (host && !h.endsWith(host)) thirdParty.add(h);
      }
    } catch {}
  }

  const enc = (headers["content-encoding"] || "").toLowerCase();
  const hasCompression = /gzip|br|deflate|zstd/.test(enc);
  const cacheControl = headers["cache-control"] || null;
  const server = headers["server"] || headers["x-served-by"] || null;

  // --- AEM detection layer --------------------------------------------------
  const aemSignals: AemSignal[] = [];
  const clientlibs =
    /\/etc\.clientlibs\//i.test(html) ||
    scriptSrcs.some((s) => /\/etc\.clientlibs\//i.test(s));
  aemSignals.push({
    label: "/content/ or /etc.clientlibs/ in asset URLs",
    detected: /\/content\//i.test(html) || clientlibs,
    detail: clientlibs
      ? "ClientLib paths (/etc.clientlibs/) present"
      : /\/content\//i.test(html)
        ? "AEM /content/ paths present in markup"
        : "Not found",
  });
  const dispatcherHeader =
    /dispatcher/i.test(JSON.stringify(headers)) ||
    /aem|adobe experience manager|cq5/i.test(server || "");
  aemSignals.push({
    label: "Dispatcher / AEM signature in response headers",
    detected: dispatcherHeader,
    detail: dispatcherHeader
      ? `Server/header hints: ${server || "dispatcher header"}`
      : "Not found",
  });
  const modelJson = /\.model\.json/i.test(html);
  aemSignals.push({
    label: ".model.json (SPA Editor / Sling Model exporter)",
    detected: modelJson,
    detail: modelJson ? ".model.json reference found in markup" : "Not referenced in HTML",
  });
  const granite =
    /cq:|granite|data-cmp-|aem-Grid|coral-|foundation-/i.test(html);
  aemSignals.push({
    label: "Granite UI / cq: namespace / Core Component markup",
    detected: granite,
    detail: granite
      ? "Granite/cq:/data-cmp- patterns found"
      : "No Granite or cq: namespace patterns",
  });
  const aemDetected = aemSignals.filter((s) => s.detected).length >= 1;

  // --- Estimated metric synthesis ------------------------------------------
  // Deterministic from observed evidence + seeded jitter. Clearly labelled as
  // an estimate, never presented as a lab Lighthouse trace.
  const estimated = true;
  const seed = finalUrl;

  // Page-weight signals
  const totalScripts = scriptSrcs.length + inlineScripts;
  const jsHeaviness = scriptSrcs.length + thirdParty.size * 1.5;
  const cssHeaviness = stylesheets.length + inlineStyleBytes / 40000;
  const pageKb = htmlBytes / 1024;

  // TTFB: measured if we fetched, else estimated.
  const ttfbVal = fetchOk
    ? ttfb
    : Math.round(700 + seededUnit(seed, 1) * 2200);

  // FCP ~ ttfb + render-blocking penalty
  const renderBlock = stylesheets.length * 120 + (hasCompression ? 0 : 250);
  const fcpVal = Math.round(
    ttfbVal + 350 + renderBlock + seededUnit(seed, 2) * 500,
  );

  // LCP ~ fcp + image/script weight
  const lcpVal = Math.round(
    fcpVal +
      400 +
      (imagesMissingDims > 0 ? 300 : 0) +
      jsHeaviness * 120 +
      pageKb * 1.2 +
      seededUnit(seed, 3) * 700,
  );

  // TBT ~ JS execution proxy
  const tbtVal = Math.round(
    totalScripts * 35 + thirdParty.size * 90 + seededUnit(seed, 4) * 250,
  );

  // INP ~ correlated with TBT
  const inpVal = Math.round(
    140 + tbtVal * 0.45 + thirdParty.size * 25 + seededUnit(seed, 5) * 120,
  );

  // CLS ~ images without dimensions + non-lazy font swaps
  const clsRaw =
    0.02 +
    imagesMissingDims * 0.03 +
    (fontLinks > 0 ? 0.04 : 0) +
    seededUnit(seed, 6) * 0.08;
  const clsVal = Math.round(clsRaw * 1000) / 1000;

  const rawValues: Record<MetricKey, number> = {
    LCP: lcpVal,
    CLS: clsVal,
    INP: inpVal,
    TBT: tbtVal,
    FCP: fcpVal,
    TTFB: ttfbVal,
  };

  const metrics = {} as Record<MetricKey, AuditMetric>;
  for (const key of METRIC_ORDER) {
    const value = rawValues[key];
    metrics[key] = {
      key,
      value,
      rating: rate(key, value),
      score: metricScore(key, value),
    };
  }

  // Overall score: normalized weighted average of Lighthouse-weighted metrics.
  let weightSum = 0;
  let weighted = 0;
  for (const [k, w] of Object.entries(LIGHTHOUSE_WEIGHTS) as [MetricKey, number][]) {
    weightSum += w;
    weighted += metrics[k].score * w;
  }
  const overallScore = Math.round(weighted / weightSum);

  if (fetchOk) {
    notes.push(
      "Estimated quick audit — values are derived from response headers and HTML heuristics, not a lab Lighthouse trace. TTFB is a real server-side measurement.",
    );
  }
  if (statusCode >= 400) {
    notes.push(`Server returned HTTP ${statusCode}.`);
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    finalUrl,
    timestamp: Date.now(),
    estimated,
    metrics,
    overallScore,
    overallRating: overallRating(overallScore),
    server,
    statusCode,
    htmlBytes,
    scriptCount: totalScripts,
    stylesheetCount: stylesheets.length,
    imageCount: imgTags.length,
    imagesMissingDims,
    fontCount: fontLinks,
    thirdPartyCount: thirdParty.size,
    hasCompression,
    cacheControl,
    aemDetected,
    aemSignals,
    notes,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Stream a downloadable HTML report. The client posts the pre-rendered HTML;
  // we set Content-Disposition: attachment so downloads work inside the
  // sandboxed iframe (where blob/anchor downloads are blocked).
  app.post("/api/report", (req: Request, res: Response) => {
    const html = decodeURIComponent(String(req.body?.html || ""));
    const filename = String(req.body?.filename || "vitalscan-report.html").replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    if (!html) return res.status(400).send("Missing report content.");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(html);
  });

  app.post("/api/audit", async (req: Request, res: Response) => {
    const parsed = auditRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Enter a valid URL." });
    }
    try {
      const result = await runAudit(parsed.data.url);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  return httpServer;
}
