"use client";

import * as React from "react";
import Link from "next/link";
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { fadeInUp, staggerChildren } from "@/lib/motion";

type Accent = "neutral" | "applied" | "skipped" | "rejected" | "offer";

// Semantic tick colors — gold stays reserved for offers/the leader.
const TICK: Record<Accent, string> = {
  neutral: "bg-muted-foreground/50",
  applied: "bg-primary",
  skipped: "bg-muted-foreground/30",
  rejected: "bg-destructive",
  offer: "bg-gold",
};

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());
  React.useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [value, reduce, mv]);
  return <motion.span>{text}</motion.span>;
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-5 gap-3"
      variants={staggerChildren(0.04)}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function KpiCard({
  label,
  value,
  accent = "neutral",
  href,
  delta,
}: {
  label: string;
  value: number;
  accent?: Accent;
  href?: string;
  delta?: { value: number; label: string };
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${TICK[accent]}`}
          aria-hidden
        />
        <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums leading-none">
        <CountUp value={value} />
      </div>
      <div className="mt-2 h-4 font-mono text-[11px] tabular-nums text-muted-foreground">
        {delta && delta.value > 0 && `+${delta.value.toLocaleString()} ${delta.label}`}
      </div>
    </>
  );
  const classes = "relative rounded-lg border bg-card p-4";
  return (
    <motion.div variants={fadeInUp}>
      {href ? (
        <Link
          href={href}
          className={`${classes} block transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        >
          {body}
        </Link>
      ) : (
        <div className={classes}>{body}</div>
      )}
    </motion.div>
  );
}
