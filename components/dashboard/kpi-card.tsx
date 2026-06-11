"use client";

import * as React from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { fadeInUp, staggerChildren } from "@/lib/motion";

type Accent = "sky" | "zinc" | "rose" | "emerald" | "violet";

const ACCENTS: Record<Accent, string> = {
  sky: "from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-300",
  zinc: "from-zinc-500/20 to-zinc-500/5 text-zinc-600 dark:text-zinc-300",
  rose: "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-300",
  emerald:
    "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-300",
  violet:
    "from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-300",
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
      variants={staggerChildren(0.05)}
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
  accent = "violet",
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
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div className="mt-1 text-3xl font-display font-semibold tabular-nums">
        <CountUp value={value} />
      </div>
      {delta && delta.value > 0 && (
        <div className="mt-0.5 flex items-center gap-1 text-xs font-medium opacity-80">
          <TrendingUp className="h-3 w-3" />+{delta.value.toLocaleString()}{" "}
          {delta.label}
        </div>
      )}
    </>
  );
  const classes = `relative rounded-xl border p-4 overflow-hidden bg-gradient-to-br ${ACCENTS[accent]}`;
  return (
    <motion.div variants={fadeInUp}>
      {href ? (
        <Link
          href={href}
          className={`${classes} block transition-transform hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        >
          {body}
        </Link>
      ) : (
        <div className={classes}>{body}</div>
      )}
    </motion.div>
  );
}
