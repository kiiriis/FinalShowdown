"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Payload = {
  type: "job.created" | "job.updated" | "job.deleted" | "entry.updated";
  actorId?: string;
  ts: number;
};

/**
 * Subscribes to /api/events and calls router.refresh() on any change.
 * Ignores events this client just caused (actorId === currentUserId) —
 * those rows already re-fetched locally via router.refresh() in the mutation.
 */
export function useLiveRefresh(currentUserId?: string) {
  const router = useRouter();

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const es = new EventSource("/api/events");

    const refresh = () => router.refresh();

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data) as Payload;
        if (payload.actorId && payload.actorId === currentUserId) return;
        refresh();
      } catch {
        refresh();
      }
    };

    es.onerror = () => {
      // Browser will auto-reconnect with backoff.
    };

    return () => es.close();
  }, [router, currentUserId]);
}
