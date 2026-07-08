"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const schema = z.object({
  company: z.string().min(1, "Required"),
  position: z.string().min(1, "Required"),
  link: z.string().url("Must be a valid URL"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function AddJobDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Keyboard shortcut: "n"
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 409) {
        const dup = (await res.json().catch(() => null)) as {
          id?: string;
          company?: string;
          position?: string;
        } | null;
        toast.error("A job with that link already exists.", {
          description:
            dup?.company && dup?.position
              ? `${dup.company} — ${dup.position}`
              : undefined,
          action: dup?.id
            ? {
                label: "Jump to it",
                onClick: () => {
                  setOpen(false);
                  // JobsBoard listens for this event and scrolls the row into view.
                  window.dispatchEvent(
                    new CustomEvent("fs:jobs:focus", {
                      detail: { jobId: dup.id },
                    }),
                  );
                },
              }
            : undefined,
        });
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const job = await res.json();
      toast.success("Job added", { description: data.company });
      reset();
      setOpen(false);
      // The response carries the full row (addedBy + entries) — the board
      // inserts it locally, so the new job shows up instantly instead of
      // waiting on a full router.refresh() refetch of every job.
      window.dispatchEvent(
        new CustomEvent("fs:jobs:created", { detail: { job } }),
      );
    } catch {
      toast.error("Couldn't add — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>
          <Plus className="h-4 w-4 mr-1" />
          Add job
          <kbd className="ml-2 rounded bg-white/20 px-1 text-[10px]">N</kbd>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new job</DialogTitle>
          <DialogDescription>
            Paste the link and fill in basics. It’ll show up for everyone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              placeholder="Stripe"
              aria-invalid={!!errors.company}
              aria-describedby={errors.company ? "company-error" : undefined}
              {...register("company")}
              autoFocus
            />
            {errors.company && (
              <p
                id="company-error"
                role="alert"
                className="text-xs text-rose-500 animate-in fade-in-0 slide-in-from-top-1 duration-200"
              >
                {errors.company.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              placeholder="Software Engineer, New Grad"
              aria-invalid={!!errors.position}
              aria-describedby={errors.position ? "position-error" : undefined}
              {...register("position")}
            />
            {errors.position && (
              <p
                id="position-error"
                role="alert"
                className="text-xs text-rose-500 animate-in fade-in-0 slide-in-from-top-1 duration-200"
              >
                {errors.position.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link">Link</Label>
            <Input
              id="link"
              placeholder="https://…"
              aria-invalid={!!errors.link}
              aria-describedby={errors.link ? "link-error" : undefined}
              {...register("link")}
            />
            {errors.link && (
              <p
                id="link-error"
                role="alert"
                className="text-xs text-rose-500 animate-in fade-in-0 slide-in-from-top-1 duration-200"
              >
                {errors.link.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="OA format, recruiter name, etc."
              {...register("notes")}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
