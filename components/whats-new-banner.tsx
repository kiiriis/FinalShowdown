"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, X, ArrowRight } from "lucide-react";

const STORAGE_KEY = "fs:whatsnew:templates:banner-dismissed";

export function WhatsNewBanner() {
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
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-violet-500/10 via-sky-500/5 to-transparent p-4 sm:p-5">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,theme(colors.violet.400/0.15),transparent_60%)]" />
      <div className="relative flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 p-2 text-white shadow-md">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
              New
            </span>
            <span className="text-sm font-semibold">Message templates</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Two new buttons on every job row now generate your LinkedIn
            connection request and referral-ask, pre-filled with that job's
            company, role, and link. Hover any row to find them.
          </p>
          <Link
            href="/settings/templates"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
          >
            Customize your templates
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
