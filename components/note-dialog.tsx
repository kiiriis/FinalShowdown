"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn, initials } from "@/lib/utils";

type NoteUser = {
  id: string;
  displayName: string;
  image?: string | null;
};
type NoteEntry = {
  id?: string;
  userId: string;
  note?: string | null;
};

export function NoteDialog({
  jobId,
  jobTitle,
  users,
  entries,
  currentUserId,
  onSaved,
}: {
  jobId: string;
  jobTitle: string;
  users: NoteUser[];
  entries: NoteEntry[];
  currentUserId: string;
  onSaved: (updated: {
    entryId: string;
    userId: string;
    note: string | null;
  }) => void;
}) {
  const myEntry = entries.find((e) => e.userId === currentUserId);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(myEntry?.note ?? "");
  const [saving, setSaving] = React.useState(false);

  // Re-sync draft when someone else's edit (via SSE) changes our note.
  React.useEffect(() => {
    if (!open) setDraft(myEntry?.note ?? "");
  }, [myEntry?.note, open]);

  const othersWithNotes = entries.filter(
    (e) => e.userId !== currentUserId && e.note && e.note.trim().length > 0,
  );
  const totalNotes =
    othersWithNotes.length + (myEntry?.note?.trim() ? 1 : 0);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId,
          userId: currentUserId,
          note: draft.trim() === "" ? null : draft.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        id: string;
        note: string | null;
      };
      onSaved({
        entryId: data.id,
        userId: currentUserId,
        note: data.note,
      });
      toast.success(data.note ? "Note saved" : "Note cleared");
      setOpen(false);
    } catch {
      toast.error("Couldn't save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative shrink-0 transition-colors",
            totalNotes > 0
              ? "text-amber-500 dark:text-amber-300"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={
            totalNotes > 0 ? `${totalNotes} note(s)` : "Add a note"
          }
          title={totalNotes > 0 ? `${totalNotes} note(s)` : "Add a note"}
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          {totalNotes > 0 && (
            <span className="absolute -top-1.5 -right-2 text-[9px] font-semibold leading-none rounded-full bg-amber-500 text-white px-1 py-0.5 min-w-[14px] text-center">
              {totalNotes}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notes</DialogTitle>
          <DialogDescription className="truncate">
            {jobTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Others' notes */}
          {othersWithNotes.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-auto scrollbar-thin pr-1">
              {othersWithNotes.map((e) => {
                const u = users.find((x) => x.id === e.userId);
                if (!u) return null;
                return (
                  <div
                    key={e.userId}
                    className="rounded-lg border bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar className="h-5 w-5">
                        {u.image && (
                          <AvatarImage src={u.image} alt={u.displayName} />
                        )}
                        <AvatarFallback className="text-[9px]">
                          {initials(u.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">
                        {u.displayName}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {e.note}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* My note — editable */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Your note
              </label>
              <span className="text-[10px] text-muted-foreground">
                {draft.length}/2000
              </span>
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              placeholder="Drop a message — e.g. 'needs a referral', 'OA easy', 'ghosted after 2 weeks'…"
              className="min-h-[100px] resize-y"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
