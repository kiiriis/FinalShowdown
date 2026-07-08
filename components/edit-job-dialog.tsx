"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: {
    id: string;
    company: string;
    position: string;
    link: string;
    notes?: string | null;
  };
  onSaved?: (job: {
    id: string;
    company: string;
    position: string;
    link: string;
    notes: string | null;
  }) => void;
};

// Controlled dialog — one instance on the board. The old per-row version
// mounted a react-hook-form + zod resolver for every row on the page.
export function EditJobDialog({ open, onOpenChange, job, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      company: job.company,
      position: job.position,
      link: job.link,
      notes: job.notes ?? "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        company: job.company,
        position: job.position,
        link: job.link,
        notes: job.notes ?? "",
      });
    }
  }, [open, job, reset]);

  function onSubmit(data: FormData) {
    const notes = data.notes?.trim() ? data.notes : null;
    const prev = {
      id: job.id,
      company: job.company,
      position: job.position,
      link: job.link,
      notes: job.notes ?? null,
    };

    // Optimistic: reflect + close now; reconcile in the background.
    onSaved?.({ id: job.id, ...data, notes });
    onOpenChange(false);

    fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, notes }),
    })
      .then(async (res) => {
        if (res.status === 409) {
          const clash = (await res.json().catch(() => null)) as {
            company?: string;
          } | null;
          throw new Error(
            clash?.company
              ? `Another job (${clash.company}) already uses that link.`
              : "Another job already uses that link.",
          );
        }
        if (!res.ok) throw new Error("Couldn't save.");
        const updated = await res.json();
        onSaved?.(updated);
        toast.success("Job updated", { description: data.company });
      })
      .catch((err: Error) => {
        onSaved?.(prev);
        toast.error("Edit reverted", {
          description: err.message || "Couldn't save — try again.",
        });
      });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit job</DialogTitle>
          <DialogDescription>
            Update details or add notes. Everyone sees the change.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              aria-invalid={!!errors.company}
              aria-describedby={errors.company ? "edit-company-error" : undefined}
              {...register("company")}
              autoFocus
            />
            {errors.company && (
              <p
                id="edit-company-error"
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
              aria-invalid={!!errors.position}
              aria-describedby={
                errors.position ? "edit-position-error" : undefined
              }
              {...register("position")}
            />
            {errors.position && (
              <p
                id="edit-position-error"
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
              aria-invalid={!!errors.link}
              aria-describedby={errors.link ? "edit-link-error" : undefined}
              {...register("link")}
            />
            {errors.link && (
              <p
                id="edit-link-error"
                role="alert"
                className="text-xs text-rose-500 animate-in fade-in-0 slide-in-from-top-1 duration-200"
              >
                {errors.link.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={4}
              placeholder="OA format, recruiter name, deadline, anything useful for the squad…"
              {...register("notes")}
            />
            <p className="text-xs text-muted-foreground">
              Visible to everyone. Markdown not rendered — just plain text.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
