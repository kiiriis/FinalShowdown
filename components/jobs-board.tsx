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
  DialogTrigger,
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
import {
  APP_STATUSES,
  APP_STATUS_LABEL,
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABEL,
  REFERRAL_STATUS_STYLE,
} from "@/lib/status-maps";
import { buildSearchText, normalizeQuery } from "@/lib/search";

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
  // Day-grouping uses the viewer's local timezone. We only turn it on after
  // mount so SSR (server TZ) and first client render match — otherwise jobs
  // near a day boundary would land in different buckets and React would throw
  // a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  const PAGE_SIZE = 200;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  React.useEffect(() => setJobs(initialJobs), [initialJobs]);
  React.useEffect(() => setMounted(true), []);
  // Reset pagination whenever the filtered set changes — otherwise switching
  // filters could leave a huge window open or hide results behind the cap.
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery, myStatus, onlyReferrals, onlyUntouched, sort]);

  const searchIndex = React.useMemo(
    () => new Map(jobs.map((j) => [j.id, buildSearchText(j)])),
    [jobs],
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
        window.location.href = "/dashboard";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      setVisibleCount(Math.max(PAGE_SIZE, initialJobs.length));
      setFocusedJobId(detail.jobId);
    };
    window.addEventListener("fs:jobs:focus", handler);
    return () => window.removeEventListener("fs:jobs:focus", handler);
  }, [initialJobs.length]);

  React.useEffect(() => {
    if (!focusedJobId) return;
    // Let React flush the filter/pagination resets before we try to scroll.
    const t = setTimeout(() => {
      const el = document.getElementById(`job-${focusedJobId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(
          "ring-2",
          "ring-amber-500",
          "ring-offset-2",
          "ring-offset-background",
        );
        setTimeout(() => {
          el.classList.remove(
            "ring-2",
            "ring-amber-500",
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
    // rendered under the Load More cap.
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this job? This also clears everyone's status.")) return;
    const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    if (res.ok) {
      setJobs((s) => s.filter((j) => j.id !== id));
      toast.success("Job deleted");
      router.refresh();
    } else {
      toast.error("Couldn't delete");
    }
  }

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
        <AddJobDialog />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {filtered.length} of {jobs.length} jobs
        </span>
        <span>
          Press <kbd className="rounded bg-muted px-1">/</kbd> to search •{" "}
          <kbd className="rounded bg-muted px-1">N</kbd> to add •{" "}
          <kbd className="rounded bg-muted px-1">D</kbd> dashboard
        </span>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_420px_160px_64px] gap-4 px-4 py-2.5 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              {group.label && (
                <div className="flex items-center gap-2 px-4 py-2 border-b text-sm bg-gradient-to-r from-violet-500/10 via-sky-500/10 to-transparent">
                  <CalendarDays className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
                  <span
                    className="font-semibold tabular-nums text-violet-700 dark:text-violet-200"
                    suppressHydrationWarning
                  >
                    {group.label.date}
                  </span>
                  <span
                    className="text-sky-700/80 dark:text-sky-300/80"
                    suppressHydrationWarning
                  >
                    · {group.label.weekday}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {group.jobs.length < group.total && (
                      <span className="text-[10px] text-muted-foreground">
                        {group.jobs.length.toLocaleString()} shown
                      </span>
                    )}
                    <span className="text-xs font-medium rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-200 px-2 py-0.5">
                      {group.total.toLocaleString()}{" "}
                      {group.total === 1 ? "job" : "jobs"}
                    </span>
                  </span>
                </div>
              )}
              <ul className="divide-y">
                {group.jobs.map((job) => (
                  <li
                    key={job.id}
                    id={`job-${job.id}`}
                    className="group grid md:grid-cols-[minmax(0,1fr)_420px_160px_120px] gap-2 md:gap-4 px-4 py-3 hover:bg-muted/30 transition-all rounded-md"
                  >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {job.company}
                      </span>
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
                      <NoteDialog
                        jobId={job.id}
                        jobTitle={`${job.company} — ${job.position || ""}`.trim()}
                        users={users}
                        entries={job.entries}
                        currentUserId={currentUserId}
                        onSaved={(upd) =>
                          setJobs((prev) =>
                            prev.map((j) =>
                              j.id === job.id
                                ? {
                                    ...j,
                                    entries: upsertNote(
                                      j.entries,
                                      upd.userId,
                                      upd.entryId,
                                      upd.note,
                                    ),
                                  }
                                : j,
                            ),
                          )
                        }
                      />
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
                    currentUserName={
                      users.find((u) => u.id === currentUserId)?.displayName ??
                      "You"
                    }
                    followUpDelayDays={
                      currentUserTemplates?.followUpDelayDays ?? 2
                    }
                    onEntryUpdated={(entry) => {
                      setJobs((prev) =>
                        prev.map((j) =>
                          j.id === job.id
                            ? {
                                ...j,
                                entries: upsertEntry(j.entries, entry),
                              }
                            : j,
                        ),
                      );
                      // EXPIRED cascades to other users server-side, so refetch
                      // after the actor toggles it to pull the cascade locally.
                      if (entry.status === "EXPIRED") {
                        router.refresh();
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="h-5 w-5">
                      {job.addedBy.image && (
                        <AvatarImage
                          src={job.addedBy.image}
                          alt={job.addedBy.displayName}
                        />
                      )}
                      <AvatarFallback className="text-[9px]">
                        {initials(job.addedBy.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">
                      {job.addedBy.displayName}
                    </span>
                    <span suppressHydrationWarning>
                      · {formatRelative(job.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <JobInfoDialog job={job} users={users} />
                    {currentUserTemplates && (
                      <>
                        <MessageTemplateDialog
                          kind="connection"
                          job={{
                            company: job.company,
                            position: job.position,
                            link: job.link,
                          }}
                          user={currentUserTemplates}
                        />
                        <MessageTemplateDialog
                          kind="referral"
                          job={{
                            company: job.company,
                            position: job.position,
                            link: job.link,
                          }}
                          user={currentUserTemplates}
                        />
                      </>
                    )}
                    {(job.addedBy.id === currentUserId || isAdmin) && (
                      <>
                        <EditJobDialog
                          job={job}
                          onSaved={(updated) =>
                            setJobs((prev) =>
                              prev.map((j) =>
                                j.id === updated.id ? { ...j, ...updated } : j,
                              ),
                            )
                          }
                        />
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          aria-label="Delete job"
                          title="Delete job"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      {filtered.length > visibleCount && (
        <div className="flex flex-col items-center gap-2 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setVisibleCount((v) =>
                Math.min(v + PAGE_SIZE, filtered.length),
              )
            }
          >
            Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
          </Button>
          <p className="text-xs text-muted-foreground">
            Showing {visibleCount.toLocaleString()} of{" "}
            {filtered.length.toLocaleString()} results
          </p>
        </div>
      )}
    </div>
  );
}

type EntryUpdate = Partial<Entry> & { id: string; userId: string };

function MyTrackingControls({
  job,
  currentUserId,
  currentUserName,
  followUpDelayDays,
  onEntryUpdated,
}: {
  job: Job;
  currentUserId: string;
  currentUserName: string;
  followUpDelayDays: number;
  onEntryUpdated: (entry: EntryUpdate) => void;
}) {
  const entry = job.entries.find((e) => e.userId === currentUserId);
  const due = getFollowUpSuggestions(entry, followUpDelayDays);

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
            onEntryUpdated({
              id: upd.entryId,
              userId: currentUserId,
              status: upd.status,
              referral: upd.referral,
              updatedAt: new Date(),
            })
          }
        />
        <ReferralTrackingDialog
          jobId={job.id}
          userId={currentUserId}
          entry={entry}
          onUpdated={onEntryUpdated}
        />
        <ColdEmailDialog
          jobId={job.id}
          userId={currentUserId}
          entry={entry}
          onUpdated={onEntryUpdated}
        />
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
  jobId,
  userId,
  entry,
  onUpdated,
}: {
  jobId: string;
  userId: string;
  entry?: Entry;
  onUpdated: (entry: EntryUpdate) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
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
    setDraftReferral(entry?.referral ?? "NONE");
    setSentDate(dateInputValue(entry?.referralSentAt));
    setFollowUpSent(entry?.referralFollowUpSent ?? false);
  }, [open, entry?.referral, entry?.referralSentAt, entry?.referralFollowUpSent]);

  async function save() {
    setSaving(true);
    let nextStatus: AppStatus | undefined;
    const currentStatus = entry?.status ?? "NONE";
    if (draftReferral === "RECEIVED" && currentStatus === "APPLIED") {
      nextStatus = "APPLIED_WITH_REFERRAL";
    }
    if (draftReferral === "REQUESTED" && currentStatus === "APPLIED_WITH_REFERRAL") {
      nextStatus = "APPLIED";
    }
    const nextSentDate =
      draftReferral === "NONE" ? null : sentDate || todayInputValue();

    try {
      const res = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId,
          userId,
          referral: draftReferral,
          referralSentAt: nextSentDate,
          referralFollowUpSent:
            draftReferral === "NONE" ? false : followUpSent,
          ...(nextStatus && { status: nextStatus }),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Entry;
      onUpdated({
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
      });
      toast.success("Referral updated");
      setOpen(false);
    } catch {
      toast.error("Couldn't save referral");
    } finally {
      setSaving(false);
    }
  }

  const referral = entry?.referral ?? "NONE";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
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
      </DialogTrigger>
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
                  onClick={() => setDraftReferral(r)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
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
              htmlFor={`referral-date-${jobId}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Sent date
            </label>
            <Input
              id={`referral-date-${jobId}`}
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
              onChange={(e) => setFollowUpSent(e.target.checked)}
              disabled={draftReferral === "NONE"}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Follow-up sent
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColdEmailDialog({
  jobId,
  userId,
  entry,
  onUpdated,
}: {
  jobId: string;
  userId: string;
  entry?: Entry;
  onUpdated: (entry: EntryUpdate) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sentDate, setSentDate] = React.useState(
    dateInputValue(entry?.coldEmailSentAt),
  );
  const [followUpSent, setFollowUpSent] = React.useState(
    entry?.coldEmailFollowUpSent ?? false,
  );

  React.useEffect(() => {
    if (!open) return;
    setSentDate(dateInputValue(entry?.coldEmailSentAt));
    setFollowUpSent(entry?.coldEmailFollowUpSent ?? false);
  }, [open, entry?.coldEmailSentAt, entry?.coldEmailFollowUpSent]);

  async function save(nextSent: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId,
          userId,
          coldEmailSent: nextSent,
          coldEmailSentAt: nextSent ? sentDate || todayInputValue() : null,
          coldEmailFollowUpSent: nextSent ? followUpSent : false,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Entry;
      onUpdated({
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
      });
      toast.success(data.coldEmailSent ? "Cold email marked sent" : "Cold email cleared");
      setOpen(false);
    } catch {
      toast.error("Couldn't save cold email status");
    } finally {
      setSaving(false);
    }
  }

  const sent = entry?.coldEmailSent ?? false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            sent
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
              : "bg-muted/40 text-muted-foreground border-border",
          )}
          aria-label="Manage cold email"
          title="Cold email / cold DM"
        >
          {sent ? <MailCheck className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
          {entry?.coldEmailFollowUpSent
            ? "Cold follow-up sent"
            : sent
              ? "Cold sent"
              : "Cold email"}
        </button>
      </DialogTrigger>
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
              htmlFor={`cold-date-${jobId}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Sent date
            </label>
            <Input
              id={`cold-date-${jobId}`}
              type="date"
              value={sentDate}
              onChange={(e) => setSentDate(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={followUpSent}
              onChange={(e) => setFollowUpSent(e.target.checked)}
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
            disabled={saving || !sent}
          >
            Clear
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => save(true)} disabled={saving}>
              {saving ? "Saving..." : "Save sent"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JobInfoDialog({ job, users }: { job: Job; users: User[] }) {
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
  const total =
    applied.length + referralRequested.length + coldSent.length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="transition-opacity p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="View group activity"
          title="View group activity"
        >
          <Info className="h-3.5 w-3.5" />
          {total > 0 && (
            <span className="sr-only">
              {total} group activity updates
            </span>
          )}
        </button>
      </DialogTrigger>
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

function dateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">No jobs match those filters</p>
      <p className="text-sm text-muted-foreground max-w-sm mt-1">
        Try clearing filters or add a new job with{" "}
        <kbd className="rounded bg-muted px-1">N</kbd>.
      </p>
    </div>
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
