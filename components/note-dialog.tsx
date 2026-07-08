"use client";

import * as React from "react";
import { Eye, Pencil } from "lucide-react";
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

// Controlled dialog — one instance on the board (was one per row).
export function NoteDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  users,
  entries,
  currentUserId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const me = users.find((u) => u.id === currentUserId);
  const [draft, setDraft] = React.useState("");
  const [preview, setPreview] = React.useState(false);

  // Load the active job's note on every open (the instance is reused across
  // jobs). Read through a ref so mid-edit SSE updates can't clobber typing.
  const noteRef = React.useRef("");
  noteRef.current = myEntry?.note ?? "";
  React.useEffect(() => {
    if (open) {
      setDraft(noteRef.current);
      setPreview(false);
    }
  }, [open, jobId]);

  const othersWithNotes = entries.filter(
    (e) => e.userId !== currentUserId && e.note && e.note.trim().length > 0,
  );

  function save() {
    const next = draft.trim() === "" ? null : draft.trim();
    const prevNote = myEntry?.note ?? null;
    const localEntryId = myEntry?.id ?? `optimistic-${jobId}`;

    // Optimistic: reflect + close now; reconcile in the background.
    onSaved({ entryId: localEntryId, userId: currentUserId, note: next });
    onOpenChange(false);

    fetch("/api/entries", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId,
        userId: currentUserId,
        note: next,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { id: string; note: string | null };
        onSaved({ entryId: data.id, userId: currentUserId, note: data.note });
        toast.success(data.note ? "Note saved" : "Note cleared");
      })
      .catch(() => {
        onSaved({ entryId: localEntryId, userId: currentUserId, note: prevNote });
        toast.error("Couldn't save note — reverted.");
      });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="min-w-0">
          <DialogTitle>Notes</DialogTitle>
          <DialogDescription className="break-words">
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

          {/* My note — editable + preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Your note
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {draft.length}/2000
                </span>
                <button
                  type="button"
                  onClick={() => setPreview((p) => !p)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    preview
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={preview ? "Switch to edit" : "Preview note"}
                  title={preview ? "Switch to edit" : "Preview how others see it"}
                >
                  {preview ? (
                    <>
                      <Pencil className="h-3 w-3" /> Edit
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" /> Preview
                    </>
                  )}
                </button>
              </div>
            </div>
            {preview ? (
              <div className="rounded-lg border bg-muted/30 p-3 min-h-[100px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar className="h-5 w-5">
                    {me?.image && (
                      <AvatarImage src={me.image} alt={me.displayName} />
                    )}
                    <AvatarFallback className="text-[9px]">
                      {initials(me?.displayName ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">
                    {me?.displayName ?? "You"}
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                    Preview
                  </span>
                </div>
                {draft.trim() ? (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {draft}
                  </p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    Nothing to preview yet — write something in Edit mode.
                  </p>
                )}
              </div>
            ) : (
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
                placeholder="Drop a message — e.g. 'needs a referral', 'OA easy', 'ghosted after 2 weeks'…"
                className="min-h-[100px] resize-y"
              />
            )}
          </div>
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
