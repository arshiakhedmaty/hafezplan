import { toast } from "sonner";

/**
 * Detects transient connectivity failures (offline, DNS blip, aborted fetch)
 * as opposed to real backend errors like "invalid credentials".
 */
export function isConnectionError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_network|timeout/i.test(
    message,
  );
}

let lastNotice = 0;
const NOTICE_INTERVAL_MS = 8_000;

/** Non-blocking, rate-limited "connection lost" toast. */
export function notifyConnectionIssue(message = "Connection lost — retrying") {
  const now = Date.now();
  if (now - lastNotice < NOTICE_INTERVAL_MS) return;
  lastNotice = now;
  toast.warning(message);
}
