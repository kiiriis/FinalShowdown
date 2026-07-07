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
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  TemplateKind,
  getDefaultTemplate,
  renderTemplate,
} from "@/lib/templates";

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

// Controlled dialog — the board renders exactly ONE instance and feeds it the
// active job. (It used to be two instances per row, which meant hundreds of
// mounted dialog roots and visible lag opening any of them.)
export function MessageTemplateDialog({
  open,
  onOpenChange,
  kind,
  job,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: TemplateKind;
  job: Job;
  user: CurrentUserTemplates;
}) {
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

  // When the dialog opens (or the underlying job/template changes), refresh
  // the draft so the user always starts from the latest saved template.
  React.useEffect(() => {
    if (open) setDraft(rendered);
  }, [open, rendered]);

  const Icon = kind === "connection" ? UserPlus : Handshake;
  const label = kind === "connection" ? "Connection request" : "Referral ask";

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Copied to clipboard");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onClick={() => onOpenChange(false)}
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
