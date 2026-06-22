import { THRESHOLDS, type MetricKey, type RatingKey } from "@shared/schema";

export function formatMetric(key: MetricKey, value: number): string {
  const t = THRESHOLDS[key];
  if (t.unit === "score") return value.toFixed(3);
  if (value >= 1000) return (value / 1000).toFixed(2) + " s";
  return Math.round(value) + " ms";
}

export function formatThreshold(key: MetricKey, value: number): string {
  const t = THRESHOLDS[key];
  if (t.unit === "score") return value.toFixed(2);
  if (value >= 1000) return value / 1000 + " s";
  return value + " ms";
}

export const RATING_LABEL: Record<RatingKey, string> = {
  good: "Good",
  "needs-improvement": "Needs Improvement",
  poor: "Poor",
};

// Maps rating -> tailwind tokens defined in index.css / tailwind.config.ts
export const RATING_CLASS: Record<
  RatingKey,
  { badge: string; bar: string; text: string; soft: string }
> = {
  good: {
    badge: "bg-good text-good-foreground",
    bar: "bg-good",
    text: "text-good",
    soft: "bg-good-soft",
  },
  "needs-improvement": {
    badge: "bg-needs text-needs-foreground",
    bar: "bg-needs",
    text: "text-needs",
    soft: "bg-needs-soft",
  },
  poor: {
    badge: "bg-poor text-poor-foreground",
    bar: "bg-poor",
    text: "text-poor",
    soft: "bg-poor-soft",
  },
};

export function scoreBand(score: number): RatingKey {
  if (score >= 90) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
}

export function formatBytes(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(2) + " MB";
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
