"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Payload = {
  type: "job.created" | "job.updated" | "job.deleted" | "entry.updated";
  actorId?: string;
  ts: number;
};

// Server sends heartbeats every 25s; if we go this long without hearing
// anything, treat the stream as dead and reconnect.
const STALE_AFTER_MS = 40_000;

/**
 * Subscribes to /api/events and calls router.refresh() on any change.
 *
 * Resilience: SSE connections silently die (proxy idle timeouts, sleep/wake,
 * deploy restarts, flaky wifi) and the browser's auto-reconnect is best-effort.
 * We layer three recoveries: a heartbeat watchdog, a reconnect on tab-visible,
 * and a reconnect on network-online. Each also triggers router.refresh() so
 * anything missed while we were dark gets picked up.
 *
 * Skips events this client just caused (actorId === currentUserId) —
 * those rows already re-fetched locally via router.refresh() in the mutation.
 */
export function useLiveRefresh(currentUserId?: string) {
  const router = useRouter();

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let es: EventSource | null = null;
    let lastBeat = Date.now();
    let watchdog: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const refresh = () => router.refresh();

    const connect = () => {
      if (closed) return;
      if (es) {
        try { es.close(); } catch { /* noop */ }
      }
      lastBeat = Date.now();
      es = new EventSource("/api/events");

      es.onmessage = (ev) => {
        lastBeat = Date.now();
        try {
          const payload = JSON.parse(ev.data) as Payload;
          if (payload.actorId && payload.actorId === currentUserId) return;
          refresh();
        } catch {
          refresh();
        }
      };

      es.addEventListener("ping", () => {
        lastBeat = Date.now();
      });

      es.onerror = () => {
        // Browser will attempt its own reconnect; watchdog will force one
        // if that doesn't restore traffic within STALE_AFTER_MS.
      };
    };

    const forceReconnect = () => {
      if (closed) return;
      if (reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
        refresh();
      }, 250);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // Tab just came back — assume we missed things.
        if (Date.now() - lastBeat > STALE_AFTER_MS) {
          forceReconnect();
        } else {
          refresh();
        }
      }
    };

    const onOnline = () => forceReconnect();

    connect();

    watchdog = setInterval(() => {
      if (Date.now() - lastBeat > STALE_AFTER_MS) forceReconnect();
    }, 10_000);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      closed = true;
      if (watchdog) clearInterval(watchdog);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (es) {
        try { es.close(); } catch { /* noop */ }
      }
    };
  }, [router, currentUserId]);
}
