"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppStatus, ReferralStatus } from "@prisma/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  APP_STATUSES,
  APP_STATUS_LABEL,
  APP_STATUS_STYLE,
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABEL,
  REFERRAL_STATUS_STYLE,
} from "@/lib/status-maps";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { HandHelping, CheckCircle2, CircleSlash, Dot } from "lucide-react";

type Props = {
  entryId: string | null;
  jobId: string;
  userId: string;
  userName: string;
  status: AppStatus;
  referral: ReferralStatus;
  editable: boolean;
  onUpdated?: (update: {
    entryId: string;
    status: AppStatus;
    referral: ReferralStatus;
  }) => void;
};

export function StatusPill({
  entryId,
  jobId,
  userId,
  userName,
  status,
  referral,
  editable,
  onUpdated,
}: Props) {
  const [local, setLocal] = React.useState({ status, referral, entryId });

  async function save(next: { status?: AppStatus; referral?: ReferralStatus }) {
    const newStatus = next.status ?? local.status;
    const newReferral = next.referral ?? local.referral;
    const prev = local;
    setLocal({ ...local, status: newStatus, referral: newReferral });
    try {
      const res = await fetch(`/api/entries`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId,
          userId,
          status: newStatus,
          referral: newReferral,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        id: string;
        status: AppStatus;
        referral: ReferralStatus;
      };
      setLocal({
        entryId: data.id,
        status: data.status,
        referral: data.referral,
      });
      onUpdated?.({
        entryId: data.id,
        status: data.status,
        referral: data.referral,
      });
      toast.success("Updated");
    } catch {
      setLocal(prev);
      toast.error("Couldn't save — try again.");
    }
  }

  const pillBase =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors";
  const pillClass = cn(pillBase, APP_STATUS_STYLE[local.status]);

  const pill = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={local.status}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className={pillClass}
      >
        {APP_STATUS_LABEL[local.status]}
        <ReferralIcon referral={local.referral} />
      </motion.span>
    </AnimatePresence>
  );

  if (!editable) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{pill}</span>
        </TooltipTrigger>
        <TooltipContent>
          {userName} • {APP_STATUS_LABEL[local.status]}
          {local.referral !== "NONE" &&
            ` • ${REFERRAL_STATUS_LABEL[local.referral]}`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Change ${userName} status`}
      >
        {pill}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {APP_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => save({ status: s })}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                s === local.status ? "bg-primary" : "bg-muted-foreground/40",
              )}
            />
            {APP_STATUS_LABEL[s]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Referral</DropdownMenuLabel>
        {REFERRAL_STATUSES.map((r) => (
          <DropdownMenuItem
            key={r}
            onClick={() => save({ referral: r })}
            className={cn("flex items-center gap-2", REFERRAL_STATUS_STYLE[r])}
          >
            <ReferralIcon referral={r} />
            {REFERRAL_STATUS_LABEL[r]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReferralIcon({ referral }: { referral: ReferralStatus }) {
  switch (referral) {
    case "REQUESTED":
      return <HandHelping className="h-3 w-3" />;
    case "RECEIVED":
      return <CheckCircle2 className="h-3 w-3" />;
    case "NOT_NEEDED":
      return <CircleSlash className="h-3 w-3 opacity-50" />;
    default:
      return <Dot className="h-3 w-3 opacity-0" />;
  }
}
