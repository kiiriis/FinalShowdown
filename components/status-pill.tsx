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
} from "@/lib/status-maps";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

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

  // Keep local state in sync when props change — e.g. after router.refresh()
  // brings in cascaded changes from the server, or when SSE live-refresh
  // pulls in someone else's edits. Without this, the pill would stay frozen
  // on whatever it was mounted with until a full browser reload.
  React.useEffect(() => {
    setLocal({ status, referral, entryId });
  }, [status, referral, entryId]);

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
  const pill = (
    <motion.span
      key={local.status}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={pillClass}
    >
      {APP_STATUS_LABEL[local.status]}
    </motion.span>
  );

  if (!editable) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{pill}</span>
        </TooltipTrigger>
        <TooltipContent>
          {userName} • {APP_STATUS_LABEL[local.status]}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex rounded cursor-pointer hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Change ${userName} status`}
      >
        {pill}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Application status</DropdownMenuLabel>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
