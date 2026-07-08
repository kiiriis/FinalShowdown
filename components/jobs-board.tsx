"use client";

import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  HandHelping,
  Info,
  Inbox,
  StickyNote,
  Copy,
  Check,
  CalendarDays,
  Mail,
  MailCheck,
  MessageSquareText,
  UserPlus,
  Handshake,
  Pencil,
} from "lucide-react";
import { AppStatus, ReferralStatus } from "@prisma/client";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, formatRelative, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { StatusPill } from "./status-pill";
import { AddJobDialog } from "./add-job-dialog";
import { EditJobDialog } from "./edit-job-dialog";
import { NoteDialog } from "./note-dialog";
import { MessageTemplateDialog } from "./message-template-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  APP_STATUSES,
  APP_STATUS_LABEL,
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABEL,
  REFERRAL_STATUS_STYLE,
} from "@/lib/status-maps";
import { buildSearchText, normalizeQuery } from "@/lib/search";
import type { TemplateKind } from "@/lib/templates";

type Entry = {
  id: string;
  userId: string;
  status: AppStatus;
  referral: ReferralStatus;
  referralSentAt?: Date | string | null;
  referralFollowUpSent: boolean;
  coldEmailSent: boolean;
  coldEmailSentAt?: Date | string | null;
  coldEmailFollowUpSent: boolean;
  note?: string | null;
  updatedAt: Date | string;
};
type User = {
  id: string;
  displayName: string;
  name: string;
  image?: string | null;
};
type Job = {
  id: string;
  company: string;
  position: string;
  link: string;
  notes?: string | null;
  createdAt: Date | string;
  addedBy: User;
  entries: Entry[];
};

type SortKey = "newest" | "company" | "most-applied";

type CurrentUserTemplates = {
  displayName: string;
  email: string;
  connectionTemplate: string | null;
  referralTemplate: string | null;
  followUpDelayDays: number;
};

// Which overlay is open, and for which job. The board renders exactly ONE
// instance of each dialog and routes every row's buttons through this state —
// mounting dialogs per row (6-7 Radix roots × 200 rows) is what made opening
// any popup visibly laggy.
type ActiveDialog =
  | { kind: "referral" | "cold" | "note" | "info" | "edit"; jobId: string }
  | { kind: "template"; jobId: string; template: TemplateKind };

const FIRST_USE_KEY = "fs:whatsnew:templates:first-click";

// Render window: keep the DOM small (Radix modals apply aria-hidden/scroll
// lock across the whole page on open — cost scales with DOM size). More rows
// stream in automatically as you scroll.
const PAGE_SIZE = 60;

export function JobsBoard({
  jobs: initialJobs,
  users,
  currentUserId,
  isAdmin = false,
  currentUserTemplates = null,
}: {
  jobs: Job[];
  users: User[];
  currentUserId: string;
  isAdmin?: boolean;
  currentUserTemplates?: CurrentUserTemplates | null;
}) {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const initialStatus: AppStatus | "ALL" =
    statusParam && APP_STATUSES.includes(statusParam as AppStatus)
      ? (statusParam as AppStatus)
      : "ALL";

  const [jobs, setJobs] = React.useState(initialJobs);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [myStatus, setMyStatus] = React.useState<AppStatus | "ALL">(
    initialStatus,
  );
  const [onlyReferrals, setOnlyReferrals] = React.useState(false);
  const [onlyUntouched, setOnlyUntouched] = React.useState(false);
  // Date-range filter on the day the job was added (local timezone, inclusive
  // bounds; either side may be open-ended). Only ever set client-side, so it
  // can't cause an SSR/client hydration mismatch.
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const dateActive = Boolean(dateFrom || dateTo);
  // Day-grouping uses the viewer's local timezone. We only turn it on after
  // mount so SSR (server TZ) and first client render match — otherwise jobs
  // near a day boundary would land in different buckets and React would throw
  // a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Single-dialog state. The payload survives close so exit animations have
  // data to render; `dialogOpen` is what actually opens/closes.
  const [activeDialog, setActiveDialog] = React.useState<ActiveDialog | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // "NEW" dot on the template buttons until first use — one piece of board
  // state instead of a localStorage read + window listener in every row.
  const [showTemplateDot, setShowTemplateDot] = React.useState(false);
  React.useEffect(() => {
    try {
      setShowTemplateDot(localStorage.getItem(FIRST_USE_KEY) !== "1");
    } catch {
      // localStorage blocked — skip the dot rather than show it forever.
    }
  }, []);

  const handleOpenDialog = React.useCallback((d: ActiveDialog) => {
    if (d.kind === "template") {
      setShowTemplateDot(false);
      try {
        localStorage.setItem(FIRST_USE_KEY, "1");
      } catch {
        // Harmless if blocked.
      }
    }
    setActiveDialog(d);
    setDialogOpen(true);
  }, []);

  const closeDialog = React.useCallback((open: boolean) => {
    if (!open) setDialogOpen(false);
  }, []);

  React.useEffect(() => setJobs(initialJobs), [initialJobs]);
  React.useEffect(() => setMounted(true), []);
  // Reset pagination whenever the filtered set changes — otherwise switching
  // filters could leave a huge window open or hide results behind the cap.
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery, myStatus, onlyReferrals, onlyUntouched, sort, dateFrom, dateTo]);

  const searchIndex = React.useMemo(
    () => new Map(jobs.map((j) => [j.id, buildSearchText(j)])),
    [jobs],
  );

  const currentUserName = React.useMemo(
    () => users.find((u) => u.id === currentUserId)?.displayName ?? "You",
    [users, currentUserId],
  );

  // Keyboard: "/" focuses search, "d" → dashboard
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "d" && !typing && !e.metaKey && !e.ctrlKey) {
        router.push("/dashboard");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // When the add-job dialog detects a duplicate, it dispatches fs:jobs:focus
  // with the existing job's id. Clear every active filter (so the row is
  // actually in the DOM) and expand pagination to cover the full list before
  // scrolling + flashing the row.
  const [focusedJobId, setFocusedJobId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ jobId?: string }>).detail;
      if (!detail?.jobId) return;
      setQuery("");
      setMyStatus("ALL");
      setOnlyReferrals(false);
      setOnlyUntouched(false);
      setDateFrom("");
      setDateTo("");
      setVisibleCount(Math.max(PAGE_SIZE, initialJobs.length));
      setFocusedJobId(detail.jobId);
    };
    window.addEventListener("fs:jobs:focus", handler);
    return () => window.removeEventListener("fs:jobs:focus", handler);
  }, [initialJobs.length]);

  // A freshly created job (from the add dialog) is inserted locally so it
  // shows up instantly — no blocking refetch of the whole board.
  React.useEffect(() => {
    const handler = (e: Event) => {
      const job = (e as CustomEvent<{ job?: Job }>).detail?.job;
      if (!job?.id) return;
      setJobs((prev) =>
        prev.some((j) => j.id === job.id) ? prev : [job, ...prev],
      );
    };
    window.addEventListener("fs:jobs:created", handler);
    return () => window.removeEventListener("fs:jobs:created", handler);
  }, []);

  React.useEffect(() => {
    if (!focusedJobId) return;
    // Let React flush the filter/pagination resets before we try to scroll.
    const t = setTimeout(() => {
      const el = document.getElementById(`job-${focusedJobId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(
          "ring-2",
          "ring-primary",
          "ring-offset-2",
          "ring-offset-background",
        );
        setTimeout(() => {
          el.classList.remove(
            "ring-2",
            "ring-primary",
            "ring-offset-2",
            "ring-offset-background",
          );
        }, 2500);
      }
      setFocusedJobId(null);
    }, 60);
    return () => clearTimeout(t);
  }, [focusedJobId]);

  const filtered = React.useMemo(() => {
    let out = jobs;
    const q = normalizeQuery(deferredQuery);
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      out = out.filter((j) => {
        const hay = searchIndex.get(j.id);
        return hay !== undefined && tokens.every((t) => hay.includes(t));
      });
    }
    if (myStatus !== "ALL") {
      out = out.filter((j) => {
        const e = j.entries.find((x) => x.userId === currentUserId);
        const s = e?.status ?? "NONE";
        return s === myStatus;
      });
    }
    if (onlyReferrals) {
      out = out.filter((j) =>
        j.entries.some((e) => e.referral === "REQUESTED"),
      );
    }
    if (onlyUntouched) {
      out = out.filter((j) => {
        const touched = j.entries.some(
          (e) => e.status !== "NONE" && e.status !== "SKIPPED",
        );
        return !touched;
      });
    }
    if (dateFrom || dateTo) {
      let lo = dateFrom;
      let hi = dateTo;
      if (lo && hi && lo > hi) [lo, hi] = [hi, lo];
      out = out.filter((j) => {
        const key = localDayKey(j.createdAt);
        if (lo && key < lo) return false;
        if (hi && key > hi) return false;
        return true;
      });
    }
    if (sort === "company") {
      out = [...out].sort((a, b) => a.company.localeCompare(b.company));
    } else if (sort === "most-applied") {
      const score = (j: Job) =>
        j.entries.filter(
          (e) => e.status === "APPLIED" || e.status === "APPLIED_WITH_REFERRAL",
        ).length;
      out = [...out].sort((a, b) => score(b) - score(a));
    } else {
      out = [...out].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return out;
  }, [
    jobs,
    deferredQuery,
    myStatus,
    onlyReferrals,
    onlyUntouched,
    dateFrom,
    dateTo,
    sort,
    currentUserId,
    searchIndex,
  ]);

  type DayGroup = {
    key: string;
    label: { date: string; weekday: string } | null;
    total: number;
    jobs: Job[];
  };
  const groups: DayGroup[] = React.useMemo(() => {
    // Only chronological sort gets day headers — grouping A-Z or most-applied
    // by day would be meaningless.
    if (!mounted || sort !== "newest") {
      return [
        {
          key: "flat",
          label: null,
          total: filtered.length,
          jobs: filtered.slice(0, visibleCount),
        },
      ];
    }
    // Bucket the full filtered set first so the per-day count in the header
    // reflects every match, independent of how many rows are currently
    // rendered under the windowing cap.
    type Bucket = {
      key: string;
      label: { date: string; weekday: string };
      all: Job[];
    };
    const byKey = new Map<string, Bucket>();
    for (const job of filtered) {
      const d = new Date(job.createdAt);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;
      let b = byKey.get(key);
      if (!b) {
        b = {
          key,
          label: {
            date: d.toLocaleDateString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            }),
            weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
          },
          all: [],
        };
        byKey.set(key, b);
      }
      b.all.push(job);
    }
    // Only render jobs within the visible window, but keep each day's true
    // total for its header. Drop days that have no visible rows yet.
    const visibleIds = new Set(
      filtered.slice(0, visibleCount).map((j) => j.id),
    );
    const result: DayGroup[] = [];
    for (const b of byKey.values()) {
      const jobs = b.all.filter((j) => visibleIds.has(j.id));
      if (jobs.length === 0) continue;
      result.push({
        key: b.key,
        label: b.label,
        total: b.all.length,
        jobs,
      });
    }
    return result;
  }, [filtered, sort, mounted, visibleCount]);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  // Read current jobs through a ref so callbacks can snapshot for rollback
  // without depending on `jobs` (which would defeat row memoization).
  const jobsRef = React.useRef(jobs);
  jobsRef.current = jobs;
  const handleDelete = React.useCallback(async (id: string) => {
    if (!confirm("Delete this job? This also clears everyone's status."))
      return;
    // Optimistic: fade the row out immediately; restore if the server says no.
    const snapshot = jobsRef.current;
    setDeletingId(id);
    setTimeout(() => {
      setJobs((s) => s.filter((j) => j.id !== id));
      setDeletingId(null);
    }, 200);
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Job deleted");
    } catch {
      setJobs(snapshot);
      setDeletingId(null);
      toast.error("Couldn't delete — the job was restored.");
    }
  }, []);

  // Stable per-board callbacks so memoized rows don't re-render when siblings
  // change. Rows pass their own jobId back in.
  const handleEntryUpdated = React.useCallback(
    (jobId: string, entry: EntryUpdate) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, entries: upsertEntry(j.entries, entry) } : j,
        ),
      );
      // EXPIRED cascades to other users server-side, so refetch after the
      // actor toggles it to pull the cascade locally.
      if (entry.status === "EXPIRED") {
        router.refresh();
      }
    },
    [router],
  );

  const handleNoteSaved = React.useCallback(
    (jobId: string, upd: { entryId: string; userId: string; note: string | null }) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                entries: upsertNote(j.entries, upd.userId, upd.entryId, upd.note),
              }
            : j,
        ),
      );
    },
    [],
  );

  const handleJobSaved = React.useCallback(
    (updated: {
      id: string;
      company: string;
      position: string;
      link: string;
      notes: string | null;
    }) => {
      setJobs((prev) =>
        prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)),
      );
    },
    [],
  );

  // Auto-load more rows as the sentinel scrolls into range.
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const hasMore = filtered.length > visibleCount;
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!hasMore || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((v) => Math.min(v + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // visibleCount is a dep on purpose: re-observing after each load fires
    // again immediately if the sentinel is still within range.
  }, [hasMore, filtered.length, visibleCount]);

  // useDeferredValue lags behind while the filtered list recomputes — dim the
  // table during that window so typing feels responsive instead of frozen.
  const isStale = query !== deferredQuery;

  // The active dialog reads fresh job data from state (never a stale snapshot).
  const activeJob = activeDialog
    ? jobs.find((j) => j.id === activeDialog.jobId) ?? null
    : null;
  const activeEntry = activeJob?.entries.find(
    (e) => e.userId === currentUserId,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs, links, notes… (press /)"
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5 mr-1" />
              Filter
              {(myStatus !== "ALL" || onlyReferrals || onlyUntouched) && (
                <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 text-[10px]">
                  •
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={myStatus}
              onValueChange={(v) => setMyStatus(v as AppStatus | "ALL")}
            >
              <DropdownMenuRadioItem value="ALL">All</DropdownMenuRadioItem>
              {APP_STATUSES.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {APP_STATUS_LABEL[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={onlyReferrals}
              onCheckedChange={(c) => setOnlyReferrals(Boolean(c))}
            >
              Someone needs referral
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={onlyUntouched}
              onCheckedChange={(c) => setOnlyUntouched(Boolean(c))}
            >
              Nobody applied yet
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              {sort === "newest"
                ? "Newest"
                : sort === "company"
                  ? "Company A–Z"
                  : "Most applied"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(v) => setSort(v as SortKey)}
            >
              <DropdownMenuRadioItem value="newest">
                Newest
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="company">
                Company A–Z
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="most-applied">
                Most applied
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                dateActive && "border-primary/50 text-primary hover:text-primary",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" />
              {dateActive ? (
                <span className="font-mono text-[11px] tabular-nums">
                  {rangeLabel(dateFrom, dateTo)}
                </span>
              ) : (
                "Dates"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <div className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Added between
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label
                  htmlFor="jobs-date-from"
                  className="text-xs text-muted-foreground"
                >
                  From
                </label>
                <Input
                  id="jobs-date-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="jobs-date-to"
                  className="text-xs text-muted-foreground"
                >
                  To
                </label>
                <Input
                  id="jobs-date-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {(
                [
                  ["Today", 1],
                  ["7 days", 7],
                  ["30 days", 30],
                ] as const
              ).map(([label, days]) => (
                <Button
                  key={label}
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setDateFrom(daysAgoInputValue(days - 1));
                    setDateTo(todayInputValue());
                  }}
                >
                  {label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs ml-auto"
                disabled={!dateActive}
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave one side empty for an open-ended range.
            </p>
          </PopoverContent>
        </Popover>
        <AddJobDialog />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="font-mono tabular-nums text-[11px]">
          {filtered.length} of {jobs.length} jobs
        </span>
        <span className="hidden sm:inline">
          Press <Kbd>/</Kbd> to search · <Kbd>N</Kbd> to add · <Kbd>D</Kbd>{" "}
          dashboard
        </span>
      </div>

      {/* overflow-clip (not hidden) keeps the rounded-corner clipping without
          creating a scroll container, so the sticky day headers still work */}
      <div
        className={cn(
          "rounded-xl border bg-card overflow-clip transition-opacity duration-150",
          isStale && "opacity-60",
        )}
      >
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_420px_160px_64px] gap-4 px-4 py-2.5 border-b bg-muted/30 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <div>Company / Position</div>
          <div>My tracking</div>
          <div>Added</div>
          <div />
        </div>
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          groups.map((group) => (
            <section key={group.key}>
              {/* Day band: a visibly distinct divider between days, not a row.
                  Solid muted layer under a primary tint so the sticky header
                  also occludes rows scrolling beneath it. */}
              {group.label && (
                <div className="sticky top-14 z-10 flex items-baseline gap-2 border-y border-t-transparent px-4 py-2 bg-muted [background-image:linear-gradient(hsl(var(--primary)/0.07),hsl(var(--primary)/0.07))]">
                  <span
                    className="font-mono text-xs font-bold tabular-nums text-primary"
                    suppressHydrationWarning
                  >
                    {group.label.date}
                  </span>
                  <span
                    className="text-xs font-medium text-muted-foreground"
                    suppressHydrationWarning
                  >
                    {group.label.weekday}
                  </span>
                  <span className="ml-auto flex items-baseline gap-2">
                    {group.jobs.length < group.total && (
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {group.jobs.length.toLocaleString()} shown
                      </span>
                    )}
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-primary">
                      {group.total.toLocaleString()}{" "}
                      {group.total === 1 ? "job" : "jobs"}
                    </span>
                  </span>
                </div>
              )}
              <ul className="divide-y">
                {group.jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    users={users}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    isAdmin={isAdmin}
                    canUseTemplates={Boolean(currentUserTemplates)}
                    showTemplateDot={showTemplateDot}
                    followUpDelayDays={
                      currentUserTemplates?.followUpDelayDays ?? 2
                    }
                    deleting={deletingId === job.id}
                    onOpenDialog={handleOpenDialog}
                    onEntryUpdated={handleEntryUpdated}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-3"
        >
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            Showing {Math.min(visibleCount, filtered.length).toLocaleString()}{" "}
            of {filtered.length.toLocaleString()} — scroll for more
          </span>
        </div>
      )}

      {/* Hoisted single-instance dialogs — opened via handleOpenDialog. */}
      {activeJob && (
        <>
          <ReferralTrackingDialog
            open={dialogOpen && activeDialog?.kind === "referral"}
            onOpenChange={closeDialog}
            jobId={activeJob.id}
            userId={currentUserId}
            entry={activeEntry}
            onUpdated={handleEntryUpdated}
          />
          <ColdEmailDialog
            open={dialogOpen && activeDialog?.kind === "cold"}
            onOpenChange={closeDialog}
            jobId={activeJob.id}
            userId={currentUserId}
            entry={activeEntry}
            onUpdated={handleEntryUpdated}
          />
          <NoteDialog
            open={dialogOpen && activeDialog?.kind === "note"}
            onOpenChange={closeDialog}
            jobId={activeJob.id}
            jobTitle={`${activeJob.company} — ${activeJob.position || ""}`.trim()}
            users={users}
            entries={activeJob.entries}
            currentUserId={currentUserId}
            onSaved={(upd) => handleNoteSaved(activeJob.id, upd)}
          />
          <JobInfoDialog
            open={dialogOpen && activeDialog?.kind === "info"}
            onOpenChange={closeDialog}
            job={activeJob}
            users={users}
          />
          {(activeJob.addedBy.id === currentUserId || isAdmin) && (
            <EditJobDialog
              open={dialogOpen && activeDialog?.kind === "edit"}
              onOpenChange={closeDialog}
              job={activeJob}
              onSaved={handleJobSaved}
            />
          )}
          {currentUserTemplates && (
            <MessageTemplateDialog
              open={dialogOpen && activeDialog?.kind === "template"}
              onOpenChange={closeDialog}
              kind={
                activeDialog?.kind === "template"
                  ? activeDialog.template
                  : "connection"
              }
              job={{
                company: activeJob.company,
                position: activeJob.position,
                link: activeJob.link,
              }}
              user={currentUserTemplates}
            />
          )}
        </>
      )}
    </div>
  );
}

type EntryUpdate = Partial<Entry> & { id: string; userId: string };
type OpenDialogFn = (d: ActiveDialog) => void;

// Memoized row: with stable board callbacks, editing one job re-renders one
// row instead of the whole list.
const JobRow = React.memo(function JobRow({
  job,
  users,
  currentUserId,
  currentUserName,
  isAdmin,
  canUseTemplates,
  showTemplateDot,
  followUpDelayDays,
  deleting,
  onOpenDialog,
  onEntryUpdated,
  onDelete,
}: {
  job: Job;
  users: User[];
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  canUseTemplates: boolean;
  showTemplateDot: boolean;
  followUpDelayDays: number;
  deleting: boolean;
  onOpenDialog: OpenDialogFn;
  onEntryUpdated: (jobId: string, entry: EntryUpdate) => void;
  onDelete: (jobId: string) => void;
}) {
  const myNote = job.entries.find((e) => e.userId === currentUserId)?.note;
  const totalNotes =
    job.entries.filter(
      (e) =>
        e.userId !== currentUserId && e.note && e.note.trim().length > 0,
    ).length + (myNote?.trim() ? 1 : 0);

  return (
    <li
      id={`job-${job.id}`}
      className={cn(
        "group grid md:grid-cols-[minmax(0,1fr)_420px_160px_120px] gap-2 md:gap-4 px-4 py-3 hover:bg-muted/30 transition-all rounded-md",
        deleting && "opacity-0 -translate-x-1 pointer-events-none",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{job.company}</span>
          <Link
            href={job.link}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Open job link"
            title="Open job link"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <CopyLinkButton link={job.link} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDialog({ kind: "note", jobId: job.id });
            }}
            className={cn(
              "relative shrink-0 transition-colors",
              totalNotes > 0
                ? "text-amber-500 dark:text-amber-300"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label={totalNotes > 0 ? `${totalNotes} note(s)` : "Add a note"}
            title={totalNotes > 0 ? `${totalNotes} note(s)` : "Add a note"}
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            {totalNotes > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[9px] font-semibold leading-none rounded-full bg-amber-500 text-white px-1 py-0.5 min-w-[14px] text-center">
                {totalNotes}
              </span>
            )}
          </button>
          {job.notes && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="text-amber-500 dark:text-amber-300 shrink-0 cursor-help"
                  aria-label="Has notes"
                >
                  <StickyNote className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="max-w-xs whitespace-pre-wrap"
              >
                {job.notes}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {job.position || "—"}
        </div>
      </div>
      <MyTrackingControls
        job={job}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        followUpDelayDays={followUpDelayDays}
        onOpenDialog={onOpenDialog}
        onEntryUpdated={onEntryUpdated}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar className="h-5 w-5">
          {job.addedBy.image && (
            <AvatarImage src={job.addedBy.image} alt={job.addedBy.displayName} />
          )}
          <AvatarFallback className="text-[9px]">
            {initials(job.addedBy.displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden sm:inline">{job.addedBy.displayName}</span>
        <span
          className="font-mono text-[11px] tabular-nums"
          suppressHydrationWarning
        >
          {formatRelative(job.createdAt)}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onOpenDialog({ kind: "info", jobId: job.id })}
          className="transition-opacity p-2 md:p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="View group activity"
          title="View group activity"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        {canUseTemplates && (
          <>
            <TemplateButton
              icon={UserPlus}
              label="Generate LinkedIn connection request"
              showDot={showTemplateDot}
              onClick={() =>
                onOpenDialog({
                  kind: "template",
                  jobId: job.id,
                  template: "connection",
                })
              }
            />
            <TemplateButton
              icon={Handshake}
              label="Generate referral-ask message"
              showDot={showTemplateDot}
              onClick={() =>
                onOpenDialog({
                  kind: "template",
                  jobId: job.id,
                  template: "referral",
                })
              }
            />
          </>
        )}
        {(job.addedBy.id === currentUserId || isAdmin) && (
          <>
            <button
              type="button"
              onClick={() => onOpenDialog({ kind: "edit", jobId: job.id })}
              className="can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity p-2 md:p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Edit job"
              title="Edit job"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(job.id)}
              className="can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity p-2 md:p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              aria-label="Delete job"
              title="Delete job"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </li>
  );
});

function TemplateButton({
  icon: Icon,
  label,
  showDot,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  showDot: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative transition-opacity p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted",
        // Keep visible while the NEW dot is showing so users notice the
        // feature; once used, fall back to hover-reveal.
        showDot
          ? "opacity-100"
          : "can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100 focus-visible:opacity-100",
      )}
      aria-label={label}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      {showDot && (
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
      )}
    </button>
  );
}

function MyTrackingControls({
  job,
  currentUserId,
  currentUserName,
  followUpDelayDays,
  onOpenDialog,
  onEntryUpdated,
}: {
  job: Job;
  currentUserId: string;
  currentUserName: string;
  followUpDelayDays: number;
  onOpenDialog: OpenDialogFn;
  onEntryUpdated: (jobId: string, entry: EntryUpdate) => void;
}) {
  const entry = job.entries.find((e) => e.userId === currentUserId);
  const due = getFollowUpSuggestions(entry, followUpDelayDays);
  const referral = entry?.referral ?? "NONE";
  const coldSent = entry?.coldEmailSent ?? false;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          entryId={entry?.id ?? null}
          jobId={job.id}
          userId={currentUserId}
          userName={currentUserName}
          status={entry?.status ?? "NONE"}
          referral={entry?.referral ?? "NONE"}
          editable
          onUpdated={(upd) =>
            onEntryUpdated(job.id, {
              id: upd.entryId,
              userId: currentUserId,
              status: upd.status,
              referral: upd.referral,
              updatedAt: new Date(),
            })
          }
        />
        <button
          type="button"
          onClick={() => onOpenDialog({ kind: "referral", jobId: job.id })}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-[color,background-color,border-color,transform] active:scale-95 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
            referral === "NONE"
              ? "bg-muted/40 text-muted-foreground border-border"
              : REFERRAL_STATUS_STYLE[referral],
          )}
          aria-label="Update LinkedIn referral status"
          title="LinkedIn referral"
        >
          <HandHelping className="h-3 w-3" />
          {entry?.referralFollowUpSent
            ? "Referral follow-up sent"
            : referral === "NONE"
              ? "Referral"
              : REFERRAL_STATUS_LABEL[referral]}
        </button>
        <button
          type="button"
          onClick={() => onOpenDialog({ kind: "cold", jobId: job.id })}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-[color,background-color,border-color,transform] active:scale-95 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            coldSent
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
              : "bg-muted/40 text-muted-foreground border-border",
          )}
          aria-label="Manage cold email"
          title="Cold email / cold DM"
        >
          {coldSent ? (
            <MailCheck className="h-3 w-3" />
          ) : (
            <Mail className="h-3 w-3" />
          )}
          {entry?.coldEmailFollowUpSent
            ? "Cold follow-up sent"
            : coldSent
              ? "Cold sent"
              : "Cold email"}
        </button>
      </div>
      {due.length > 0 && (
        <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          <CalendarDays className="h-3 w-3" />
          Follow up due: {due.join(", ")}
        </div>
      )}
    </div>
  );
}

function ReferralTrackingDialog({
  open,
  onOpenChange,
  jobId,
  userId,
  entry,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  userId: string;
  entry?: Entry;
  onUpdated: (jobId: string, entry: EntryUpdate) => void;
}) {
  const [draftReferral, setDraftReferral] = React.useState<ReferralStatus>(
    entry?.referral ?? "NONE",
  );
  const [sentDate, setSentDate] = React.useState(
    dateInputValue(entry?.referralSentAt),
  );
  const [followUpSent, setFollowUpSent] = React.useState(
    entry?.referralFollowUpSent ?? false,
  );

  React.useEffect(() => {
    if (!open) return;
    const referral = entry?.referral ?? "NONE";
    setDraftReferral(referral);
    setSentDate(
      dateInputValue(entry?.referralSentAt) ||
        (referral === "NONE" ? "" : todayInputValue()),
    );
    setFollowUpSent(entry?.referralFollowUpSent ?? false);
  }, [open, jobId, entry?.referral, entry?.referralSentAt, entry?.referralFollowUpSent]);

  function selectReferralStatus(nextReferral: ReferralStatus) {
    setDraftReferral(nextReferral);
    setSentDate((current) =>
      nextReferral === "NONE" ? "" : current || todayInputValue(),
    );
  }

  function save() {
    let nextStatus: AppStatus | undefined;
    const currentStatus = entry?.status ?? "NONE";
    if (draftReferral === "RECEIVED" && currentStatus === "APPLIED") {
      nextStatus = "APPLIED_WITH_REFERRAL";
    }
    if (draftReferral === "REQUESTED" && currentStatus === "APPLIED_WITH_REFERRAL") {
      nextStatus = "APPLIED";
    }
    const nextFollowUpSent = draftReferral === "NONE" ? false : followUpSent;
    const nextSentDate =
      draftReferral === "NONE" ? null : sentDate || todayInputValue();

    // Optimistic: reflect the change and close now; the server round-trip
    // (slow on free-tier hosting) reconciles in the background.
    const prev = entrySnapshot(entry, userId, jobId);
    onUpdated(jobId, {
      id: entry?.id ?? `optimistic-${jobId}`,
      userId,
      referral: draftReferral,
      referralSentAt: nextSentDate,
      referralFollowUpSent: nextFollowUpSent,
      ...(nextStatus && { status: nextStatus }),
      updatedAt: new Date(),
    });
    onOpenChange(false);

    fetch("/api/entries", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId,
        userId,
        referral: draftReferral,
        referralSentAt: nextSentDate,
        referralFollowUpSent: nextFollowUpSent,
        ...(nextStatus && { status: nextStatus }),
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Entry;
        onUpdated(jobId, serverEntryUpdate(data));
        toast.success("Referral updated");
      })
      .catch(() => {
        onUpdated(jobId, prev);
        toast.error("Couldn't save referral — reverted.");
      });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>LinkedIn referral</DialogTitle>
          <DialogDescription>
            Track when you requested the referral and whether you followed up.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {REFERRAL_STATUSES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => selectReferralStatus(r)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-[color,background-color,border-color,transform] active:scale-95",
                    draftReferral === r
                      ? r === "NONE"
                        ? "bg-muted text-foreground border-border"
                        : REFERRAL_STATUS_STYLE[r]
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {REFERRAL_STATUS_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="referral-sent-date"
              className="text-xs font-medium text-muted-foreground"
            >
              Sent date
            </label>
            <Input
              id="referral-sent-date"
              type="date"
              value={sentDate}
              onChange={(e) => setSentDate(e.target.value)}
              disabled={draftReferral === "NONE"}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={followUpSent}
              onChange={(e) => {
                setFollowUpSent(e.target.checked);
                if (e.target.checked) {
                  setSentDate((current) => current || todayInputValue());
                }
              }}
              disabled={draftReferral === "NONE"}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Follow-up sent
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColdEmailDialog({
  open,
  onOpenChange,
  jobId,
  userId,
  entry,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  userId: string;
  entry?: Entry;
  onUpdated: (jobId: string, entry: EntryUpdate) => void;
}) {
  const [sentDate, setSentDate] = React.useState(
    dateInputValue(entry?.coldEmailSentAt),
  );
  const [followUpSent, setFollowUpSent] = React.useState(
    entry?.coldEmailFollowUpSent ?? false,
  );

  React.useEffect(() => {
    if (!open) return;
    setSentDate(dateInputValue(entry?.coldEmailSentAt) || todayInputValue());
    setFollowUpSent(entry?.coldEmailFollowUpSent ?? false);
  }, [open, jobId, entry?.coldEmailSentAt, entry?.coldEmailFollowUpSent]);

  function save(nextSent: boolean) {
    const nextSentAt = nextSent ? sentDate || todayInputValue() : null;
    const nextFollowUp = nextSent ? followUpSent : false;

    // Optimistic: reflect the change and close now; reconcile in background.
    const prev = entrySnapshot(entry, userId, jobId);
    onUpdated(jobId, {
      id: entry?.id ?? `optimistic-${jobId}`,
      userId,
      coldEmailSent: nextSent,
      coldEmailSentAt: nextSentAt,
      coldEmailFollowUpSent: nextFollowUp,
      updatedAt: new Date(),
    });
    onOpenChange(false);

    fetch("/api/entries", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId,
        userId,
        coldEmailSent: nextSent,
        coldEmailSentAt: nextSentAt,
        coldEmailFollowUpSent: nextFollowUp,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Entry;
        onUpdated(jobId, serverEntryUpdate(data));
        toast.success(
          data.coldEmailSent ? "Cold email marked sent" : "Cold email cleared",
        );
      })
      .catch(() => {
        onUpdated(jobId, prev);
        toast.error("Couldn't save cold email status — reverted.");
      });
  }

  const sent = entry?.coldEmailSent ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cold email / DM</DialogTitle>
          <DialogDescription>
            Track the exact day you sent outreach and whether you followed up.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="cold-sent-date"
              className="text-xs font-medium text-muted-foreground"
            >
              Sent date
            </label>
            <Input
              id="cold-sent-date"
              type="date"
              value={sentDate}
              onChange={(e) => setSentDate(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={followUpSent}
              onChange={(e) => {
                setFollowUpSent(e.target.checked);
                if (e.target.checked) {
                  setSentDate((current) => current || todayInputValue());
                }
              }}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Follow-up sent
          </label>
        </div>
        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => save(false)}
            disabled={!sent}
          >
            Clear
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => save(true)}>
              Save sent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JobInfoDialog({
  open,
  onOpenChange,
  job,
  users,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  users: User[];
}) {
  const applied = users.filter((u) => {
    const e = job.entries.find((x) => x.userId === u.id);
    return (
      e?.status === "APPLIED" ||
      e?.status === "APPLIED_WITH_REFERRAL" ||
      e?.status === "OFFER"
    );
  });
  const referralRequested = users.filter((u) =>
    job.entries.some((e) => e.userId === u.id && e.referral === "REQUESTED"),
  );
  const coldSent = users.filter((u) =>
    job.entries.some((e) => e.userId === u.id && e.coldEmailSent),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="min-w-0">
          <DialogTitle>Group activity</DialogTitle>
          <DialogDescription className="break-words">
            {job.company} — {job.position || "Role"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <ActivitySection title="Applied" users={applied} />
          <ActivitySection
            title="Requested LinkedIn referral"
            users={referralRequested}
          />
          <ActivitySection title="Sent cold email / DM" users={coldSent} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivitySection({ title, users }: { title: string; users: User[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {users.length}
        </span>
      </div>
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
          No one yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {users.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-2 py-1 text-xs font-medium"
            >
              <Avatar className="h-5 w-5">
                {u.image && <AvatarImage src={u.image} alt={u.displayName} />}
                <AvatarFallback className="text-[9px]">
                  {initials(u.displayName)}
                </AvatarFallback>
              </Avatar>
              {u.displayName}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// Full field snapshot used to roll back an optimistic update if the server
// rejects it. For a user with no entry yet, all-NONE renders identically to
// "no entry", so reverting to it restores the visible state.
function entrySnapshot(
  entry: Entry | undefined,
  userId: string,
  jobId: string,
): EntryUpdate {
  if (entry) return { ...entry };
  return {
    id: `optimistic-${jobId}`,
    userId,
    status: "NONE",
    referral: "NONE",
    referralSentAt: null,
    referralFollowUpSent: false,
    coldEmailSent: false,
    coldEmailSentAt: null,
    coldEmailFollowUpSent: false,
    note: null,
    updatedAt: new Date(),
  };
}

// Server response → authoritative EntryUpdate (fixes optimistic ids/fields).
function serverEntryUpdate(data: Entry): EntryUpdate {
  return {
    id: data.id,
    userId: data.userId,
    status: data.status,
    referral: data.referral,
    referralSentAt: data.referralSentAt,
    referralFollowUpSent: data.referralFollowUpSent,
    coldEmailSent: data.coldEmailSent,
    coldEmailSentAt: data.coldEmailSentAt,
    coldEmailFollowUpSent: data.coldEmailFollowUpSent,
    note: data.note,
    updatedAt: new Date(data.updatedAt),
  };
}

function dateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function todayInputValue(): string {
  return localDayKey(new Date());
}

function daysAgoInputValue(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDayKey(d);
}

// Local-timezone YYYY-MM-DD key — same bucketing as the day-group headers.
function localDayKey(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Compact toolbar label for the active range, e.g. "06/25 – 07/02".
function rangeLabel(from: string, to: string): string {
  const fmt = (key: string) => {
    const [, m, d] = key.split("-");
    return `${m}/${d}`;
  };
  if (from && to) {
    if (from > to) [from, to] = [to, from];
    return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
  }
  if (from) return `from ${fmt(from)}`;
  return `until ${fmt(to)}`;
}

function daysSince(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function getFollowUpSuggestions(
  entry: Entry | undefined,
  followUpDelayDays: number,
): string[] {
  if (!entry) return [];
  const suggestions: string[] = [];
  const referralDays = daysSince(entry.referralSentAt);
  if (
    entry.referral !== "NONE" &&
    entry.referralSentAt &&
    !entry.referralFollowUpSent &&
    referralDays !== null &&
    referralDays >= followUpDelayDays
  ) {
    suggestions.push(`LinkedIn referral (${referralDays}d)`);
  }
  const coldDays = daysSince(entry.coldEmailSentAt);
  if (
    entry.coldEmailSent &&
    entry.coldEmailSentAt &&
    !entry.coldEmailFollowUpSent &&
    coldDays !== null &&
    coldDays >= followUpDelayDays
  ) {
    suggestions.push(`cold email (${coldDays}d)`);
  }
  return suggestions;
}

function upsertEntry(entries: Entry[], next: EntryUpdate): Entry[] {
  const i = entries.findIndex((e) => e.userId === next.userId);
  const normalized: Entry = {
    id: next.id,
    userId: next.userId,
    status: next.status ?? "NONE",
    referral: next.referral ?? "NONE",
    referralSentAt: next.referralSentAt ?? null,
    referralFollowUpSent: next.referralFollowUpSent ?? false,
    coldEmailSent: next.coldEmailSent ?? false,
    coldEmailSentAt: next.coldEmailSentAt ?? null,
    coldEmailFollowUpSent: next.coldEmailFollowUpSent ?? false,
    note: next.note ?? null,
    updatedAt: next.updatedAt ?? new Date(),
  };
  if (i === -1) return [...entries, normalized];
  const copy = [...entries];
  copy[i] = {
    ...copy[i],
    ...next,
    updatedAt: next.updatedAt ?? new Date(),
  };
  return copy;
}

function upsertNote(
  entries: Entry[],
  userId: string,
  entryId: string,
  note: string | null,
): Entry[] {
  const i = entries.findIndex((e) => e.userId === userId);
  if (i === -1) {
    return [
      ...entries,
      {
        id: entryId,
        userId,
        status: "NONE",
        referral: "NONE",
        referralSentAt: null,
        referralFollowUpSent: false,
        coldEmailSent: false,
        coldEmailSentAt: null,
        coldEmailFollowUpSent: false,
        note,
        updatedAt: new Date(),
      },
    ];
  }
  const copy = [...entries];
  copy[i] = { ...copy[i], id: entryId, note, updatedAt: new Date() };
  return copy;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in-0 zoom-in-95 duration-300">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">No jobs match those filters</p>
      <p className="text-sm text-muted-foreground max-w-sm mt-1">
        Try clearing filters or add a new job with <Kbd>N</Kbd>.
      </p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
      {children}
    </kbd>
  );
}

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "shrink-0 transition-colors",
        copied
          ? "text-emerald-500"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={copied ? "Link copied" : "Copy job link"}
      title={copied ? "Copied!" : "Copy link"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
