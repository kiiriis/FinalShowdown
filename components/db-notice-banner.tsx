"use client";

import * as React from "react";
import { Database, X } from "lucide-react";

const STORAGE_KEY = "fs:notice:db-migration-2026-07:dismissed";

export function DbNoticeBanner() {
  const [mounted, setMounted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage blocked (private mode, etc.) — state-only dismiss is fine.
    }
  }

  if (!mounted || dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent p-4 sm:p-5">
      <div className="relative flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 p-2 text-white shadow-md">
          <Database className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300">
              Notice
            </span>
            <span className="text-sm font-semibold">
              Temporarily running on a backup database
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Our main database hit its monthly compute limit, so we&apos;ve
            temporarily moved to a backup database to keep things running. Some
            entries added earlier may not show right now &mdash; nothing is lost.
            Everything will be reconciled and back to normal from{" "}
            <span className="font-medium text-foreground">July 1</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notice"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
