"use client";

import * as React from "react";
import { motion } from "framer-motion";
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
    let newStatus = next.status ?? local.status;
    let newReferral = next.referral ?? local.referral;

    // Coupling rules: keep status + referral semantically consistent
    if (next.status === "APPLIED_WITH_REFERRAL") {
      // Applied WITH a referral → referral must be RECEIVED (not Requested/None)
      newReferral = "RECEIVED";
    }
    if (next.referral === "RECEIVED" && local.status === "APPLIED") {
      // Received a referral after already applying plain → promote to Applied (ref)
      newStatus = "APPLIED_WITH_REFERRAL";
    }
    if (
      next.referral === "REQUESTED" &&
      local.status === "APPLIED_WITH_REFERRAL"
    ) {
      // Can't still be requesting a referral if you already applied with one
      newStatus = "APPLIED";
    }

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
  const referralChipClass = cn(
    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
    REFERRAL_STATUS_STYLE[local.referral],
  );

  const stacked = (
    <div className="flex flex-col items-start gap-1">
      <motion.span
        key={local.status}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15 }}
        className={pillClass}
      >
        {APP_STATUS_LABEL[local.status]}
      </motion.span>
      {local.referral !== "NONE" && (
        <motion.span
          key={local.referral}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className={referralChipClass}
        >
          <ReferralIcon referral={local.referral} />
          {REFERRAL_STATUS_LABEL[local.referral]}
        </motion.span>
      )}
    </div>
  );

  if (!editable) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{stacked}</span>
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
        className="flex flex-col items-start gap-1 rounded cursor-pointer hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Change ${userName} status`}
      >
        {stacked}
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
                "inline-block h-3 w-3 rounded-full border",
                APP_STATUS_STYLE[s],
              )}
            />
            <span className={s === local.status ? "font-semibold" : ""}>
              {APP_STATUS_LABEL[s]}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Referral</DropdownMenuLabel>
        {REFERRAL_STATUSES.map((r) => (
          <DropdownMenuItem
            key={r}
            onClick={() => save({ referral: r })}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full border",
                r === "NONE"
                  ? "bg-muted border-border"
                  : REFERRAL_STATUS_STYLE[r],
              )}
            />
            <span className={r === local.referral ? "font-semibold" : ""}>
              {REFERRAL_STATUS_LABEL[r]}
            </span>
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
