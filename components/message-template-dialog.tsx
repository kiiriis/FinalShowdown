"use client";

import * as React from "react";
import { UserPlus, Handshake, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";
import {
  TemplateKind,
  getDefaultTemplate,
  renderTemplate,
} from "@/lib/templates";

const FIRST_USE_KEY = "fs:whatsnew:templates:first-click";

type Job = {
  company: string;
  position: string;
  link: string;
};

type CurrentUserTemplates = {
  displayName: string;
  email: string;
  connectionTemplate: string | null;
  referralTemplate: string | null;
};

export function MessageTemplateDialog({
  kind,
  job,
  user,
}: {
  kind: TemplateKind;
  job: Job;
  user: CurrentUserTemplates;
}) {
  const [open, setOpen] = React.useState(false);
  const [showNewDot, setShowNewDot] = React.useState(false);

  React.useEffect(() => {
    try {
      setShowNewDot(localStorage.getItem(FIRST_USE_KEY) !== "1");
    } catch {
      // localStorage blocked — skip the dot rather than show it forever.
    }
  }, []);

  function markUsed() {
    setShowNewDot(false);
    try {
      localStorage.setItem(FIRST_USE_KEY, "1");
    } catch {
      // Harmless if blocked.
    }
    // Notify any other template buttons on the page to hide their dot too.
    window.dispatchEvent(new Event("fs:templates:used"));
  }

  React.useEffect(() => {
    const handler = () => setShowNewDot(false);
    window.addEventListener("fs:templates:used", handler);
    return () => window.removeEventListener("fs:templates:used", handler);
  }, []);

  const source =
    (kind === "connection" ? user.connectionTemplate : user.referralTemplate) ??
    getDefaultTemplate(kind);

  const vars = React.useMemo(
    () => ({
      companyName: job.company,
      jobRole: job.position || "this",
      jobLink: job.link,
      userName: user.displayName,
      userEmail: user.email,
    }),
    [job.company, job.position, job.link, user.displayName, user.email],
  );

  const rendered = React.useMemo(
    () => renderTemplate(source, vars),
    [source, vars],
  );
  const [draft, setDraft] = React.useState(rendered);

  // When the dialog re-opens (or underlying template changes), refresh the
  // draft so the user always starts from the latest saved template.
  React.useEffect(() => {
    if (open) setDraft(rendered);
  }, [open, rendered]);

  const Icon = kind === "connection" ? UserPlus : Handshake;
  const label =
    kind === "connection" ? "Connection request" : "Referral ask";
  const tooltip =
    kind === "connection"
      ? "Generate LinkedIn connection request"
      : "Generate referral-ask message";

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Copied to clipboard");
      setOpen(false);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            markUsed();
          }}
          className={cn(
            "relative transition-opacity p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted",
            "hover:text-primary",
            // Keep visible when the NEW dot is showing so users notice the feature;
            // once used (or on second page load), fall back to hover-reveal.
            showNewDot
              ? "opacity-100"
              : "can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100 focus-visible:opacity-100",
          )}
          aria-label={tooltip}
          title={tooltip}
        >
          <Icon className="h-3.5 w-3.5" />
          {showNewDot && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label} for {job.company}
          </DialogTitle>
          <DialogDescription className="break-words">
            {job.position || "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Message
            </label>
            <span className="text-[10px] text-muted-foreground">
              {draft.length} chars
            </span>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[220px] resize-y font-mono text-[13px] leading-relaxed"
          />
          <p className="text-[10px] text-muted-foreground">
            Tweak freely — edits here don’t affect your saved template.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraft(rendered)}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset to template
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={copy}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
