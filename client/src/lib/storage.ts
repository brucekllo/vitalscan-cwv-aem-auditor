import type { AuditResult } from "@shared/schema";

// Safe storage wrapper. Uses localStorage when available, with try/catch and an
// in-memory fallback for sandboxed iframes that block storage. Persistence is
// the intent (per spec) — but the app never crashes when storage is denied.
const KEY = "vitalscan.history.v1";

let memoryStore: string | null = null;
let usingMemory = false;

function tryLocalStorage(): Storage | null {
  try {
    const t = "__vs_probe__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  const ls = tryLocalStorage();
  if (ls) {
    try {
      return ls.getItem(KEY);
    } catch {
      /* fall through */
    }
  }
  usingMemory = true;
  return memoryStore;
}

function writeRaw(value: string): void {
  const ls = tryLocalStorage();
  if (ls) {
    try {
      ls.setItem(KEY, value);
      return;
    } catch {
      /* fall through */
    }
  }
  usingMemory = true;
  memoryStore = value;
}

export function isMemoryFallback(): boolean {
  return usingMemory || tryLocalStorage() === null;
}

export function loadHistory(): AuditResult[] {
  const raw = readRaw();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditResult[]) : [];
  } catch {
    return [];
  }
}

export function saveAudit(result: AuditResult): AuditResult[] {
  const history = loadHistory();
  history.unshift(result);
  // Cap to keep storage bounded.
  const capped = history.slice(0, 200);
  writeRaw(JSON.stringify(capped));
  return capped;
}

export function clearHistory(): void {
  writeRaw(JSON.stringify([]));
}
