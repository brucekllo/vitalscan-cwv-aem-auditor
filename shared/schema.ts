import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Template users table (kept so the template's storage layer compiles).
// VitalScan persists audit history in the browser via localStorage, not here.
// ---------------------------------------------------------------------------
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ===========================================================================
// Core Web Vitals + Lighthouse metric model
// ===========================================================================

export type MetricKey = "LCP" | "CLS" | "INP" | "TBT" | "FCP" | "TTFB";
export type RatingKey = "good" | "needs-improvement" | "poor";

export interface ThresholdSpec {
  key: MetricKey;
  label: string;
  name: string;
  unit: "ms" | "score";
  good: number; // <= good  => good
  poor: number; // > poor   => poor; between => needs-improvement
  // Source attribution shown in-app + README.
  source: string;
  sourceUrl: string;
  note?: string;
}

// Official thresholds. Citations verified against web.dev and
// Chrome for Developers (Lighthouse) documentation.
export const THRESHOLDS: Record<MetricKey, ThresholdSpec> = {
  LCP: {
    key: "LCP",
    label: "LCP",
    name: "Largest Contentful Paint",
    unit: "ms",
    good: 2500,
    poor: 4000,
    source: "web.dev — LCP",
    sourceUrl: "https://web.dev/articles/lcp",
  },
  INP: {
    key: "INP",
    label: "INP",
    name: "Interaction to Next Paint",
    unit: "ms",
    good: 200,
    poor: 500,
    source: "web.dev — INP",
    sourceUrl: "https://web.dev/articles/inp",
  },
  CLS: {
    key: "CLS",
    label: "CLS",
    name: "Cumulative Layout Shift",
    unit: "score",
    good: 0.1,
    poor: 0.25,
    source: "web.dev — CLS",
    sourceUrl: "https://web.dev/articles/cls",
  },
  TBT: {
    key: "TBT",
    label: "TBT",
    name: "Total Blocking Time",
    unit: "ms",
    good: 200,
    poor: 600,
    source: "Chrome for Developers — Lighthouse TBT (mobile)",
    sourceUrl:
      "https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time",
    note: "Lighthouse mobile color-coding: 0-200ms green, 200-600ms orange, >600ms red.",
  },
  FCP: {
    key: "FCP",
    label: "FCP",
    name: "First Contentful Paint",
    unit: "ms",
    good: 1800,
    poor: 3000,
    source: "web.dev — FCP",
    sourceUrl: "https://web.dev/articles/fcp",
    note: "web.dev explicitly states the 1.8s good target at the 75th percentile; the 3.0s poor band is a Lighthouse / Web Vitals companion band.",
  },
  TTFB: {
    key: "TTFB",
    label: "TTFB",
    name: "Time to First Byte",
    unit: "ms",
    good: 800,
    poor: 1800,
    source: "web.dev — TTFB",
    sourceUrl: "https://web.dev/articles/ttfb",
    note: "web.dev explicitly states the 0.8s good target at the 75th percentile; the 1.8s poor band is a Lighthouse / Web Vitals companion band.",
  },
};

export const METRIC_ORDER: MetricKey[] = ["LCP", "CLS", "INP", "TBT", "FCP", "TTFB"];

// Lighthouse 10 weights. Speed Index (10%) is excluded because it is not
// requested; the remaining requested weights are normalized to 100.
export const LIGHTHOUSE_WEIGHTS: Partial<Record<MetricKey, number>> = {
  FCP: 0.1,
  LCP: 0.25,
  TBT: 0.3,
  CLS: 0.25,
};

export function rate(metric: MetricKey, value: number): RatingKey {
  const t = THRESHOLDS[metric];
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

// Lighthouse-style log-normal-ish scoring approximated with a piecewise
// linear curve anchored to the official thresholds:
//   value <= good  => 100..90
//   good..poor     => 90..50
//   poor..2*poor   => 50..0
export function metricScore(metric: MetricKey, value: number): number {
  const { good, poor } = THRESHOLDS[metric];
  if (value <= 0) return 100;
  if (value <= good) {
    return Math.round(100 - 10 * (value / good));
  }
  if (value <= poor) {
    return Math.round(90 - 40 * ((value - good) / (poor - good)));
  }
  const tail = poor; // width of the bottom band
  const over = Math.min((value - poor) / tail, 1);
  return Math.round(50 - 50 * over);
}

export interface AuditMetric {
  key: MetricKey;
  value: number;
  rating: RatingKey;
  score: number;
}

export interface AemSignal {
  label: string;
  detected: boolean;
  detail: string;
}

export interface AuditResult {
  id: string;
  url: string;
  finalUrl: string;
  timestamp: number; // epoch ms
  estimated: boolean; // true => quick heuristic audit (not a lab Lighthouse trace)
  metrics: Record<MetricKey, AuditMetric>;
  overallScore: number;
  overallRating: "good" | "needs-improvement" | "poor"; // Lighthouse 0-49/50-89/90-100 bands
  // Evidence collected server-side
  server: string | null;
  statusCode: number;
  htmlBytes: number;
  scriptCount: number;
  stylesheetCount: number;
  imageCount: number;
  imagesMissingDims: number;
  fontCount: number;
  thirdPartyCount: number;
  hasCompression: boolean;
  cacheControl: string | null;
  // AEM
  aemDetected: boolean;
  aemSignals: AemSignal[];
  // Notes
  notes: string[];
}

export function overallRating(score: number): "good" | "needs-improvement" | "poor" {
  if (score >= 90) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
}

// Request validation
export const auditRequestSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL"),
});
export type AuditRequest = z.infer<typeof auditRequestSchema>;
