"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  HandHelping,
  Inbox,
} from "lucide-react";
import { AppStatus, ReferralStatus } from "@prisma/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn, formatRelative, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { StatusPill } from "./status-pill";
import { AddJobDialog } from "./add-job-dialog";
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
import { APP_STATUSES, APP_STATUS_LABEL } from "@/lib/status-maps";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type Entry = {
  id: string;
  userId: string;
  status: AppStatus;
  referral: ReferralStatus;
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
  createdAt: Date | string;
  addedBy: User;
  entries: Entry[];
};

type SortKey = "newest" | "company" | "most-applied";

export function JobsBoard({
  jobs: initialJobs,
  users,
  currentUserId,
}: {
  jobs: Job[];
  users: User[];
  currentUserId: string;
}) {
  const [jobs, setJobs] = React.useState(initialJobs);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [myStatus, setMyStatus] = React.useState<AppStatus | "ALL">("ALL");
  const [onlyReferrals, setOnlyReferrals] = React.useState(false);
  const [onlyUntouched, setOnlyUntouched] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  React.useEffect(() => setJobs(initialJobs), [initialJobs]);

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

  const filtered = React.useMemo(() => {
    let out = jobs;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (j) =>
          j.company.toLowerCase().includes(q) ||
          j.position.toLowerCase().includes(q),
      );
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
  }, [jobs, query, myStatus, onlyReferrals, onlyUntouched, sort, currentUserId]);

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
            placeholder="Search company or position… (press /)"
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
        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Company / Position</div>
          <div>Statuses</div>
          <div>Added</div>
          <div className="w-8" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.ul
            className="divide-y"
            initial={false}
            animate="show"
            variants={{
              show: { transition: { staggerChildren: 0.01 } },
            }}
          >
            <AnimatePresence initial={false}>
              {filtered.slice(0, 400).map((job) => (
                <motion.li
                  key={job.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="group grid md:grid-cols-[1fr_auto_auto_auto] gap-2 md:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
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
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {job.position || "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {users.map((u) => {
                      const entry = job.entries.find((e) => e.userId === u.id);
                      return (
                        <div
                          key={u.id}
                          className="flex items-center gap-1"
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Avatar className="h-5 w-5">
                                {u.image && (
                                  <AvatarImage
                                    src={u.image}
                                    alt={u.displayName}
                                  />
                                )}
                                <AvatarFallback className="text-[9px]">
                                  {initials(u.displayName)}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>{u.displayName}</TooltipContent>
                          </Tooltip>
                          <StatusPill
                            entryId={entry?.id ?? null}
                            jobId={job.id}
                            userId={u.id}
                            userName={u.displayName}
                            status={entry?.status ?? "NONE"}
                            referral={entry?.referral ?? "NONE"}
                            editable={u.id === currentUserId}
                            onUpdated={(upd) => {
                              setJobs((prev) =>
                                prev.map((j) =>
                                  j.id === job.id
                                    ? {
                                        ...j,
                                        entries: upsertEntry(j.entries, {
                                          id: upd.entryId,
                                          userId: u.id,
                                          status: upd.status,
                                          referral: upd.referral,
                                          updatedAt: new Date(),
                                        }),
                                      }
                                    : j,
                                ),
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
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
                    <span>· {formatRelative(job.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-end">
                    {job.addedBy.id === currentUserId && (
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        aria-label="Delete job"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
      {filtered.length > 400 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 400 of {filtered.length} results — refine your search.
        </p>
      )}
    </div>
  );
}

function upsertEntry(entries: Entry[], next: Entry): Entry[] {
  const i = entries.findIndex((e) => e.userId === next.userId);
  if (i === -1) return [...entries, next];
  const copy = [...entries];
  copy[i] = next;
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

// Reference to avoid unused-import warning in some configs
void HandHelping;
