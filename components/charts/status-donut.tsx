"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useReducedMotion } from "framer-motion";
import { AppStatus } from "@prisma/client";
import { APP_STATUS_LABEL } from "@/lib/status-maps";

const COLORS: Record<AppStatus, string> = {
  NONE: "#94a3b8",
  APPLIED: "#0ea5e9",
  APPLIED_WITH_REFERRAL: "#8b5cf6",
  FOLLOW_UP_SENT: "#14b8a6",
  SKIPPED: "#71717a",
  REJECTED: "#f43f5e",
  EXPIRED: "#f59e0b",
  OFFER: "#10b981",
};

export function StatusDonut({
  counts,
}: {
  counts: Record<AppStatus, number>;
}) {
  const reduce = useReducedMotion();
  const data = (Object.keys(counts) as AppStatus[])
    .filter((k) => counts[k] > 0 && k !== "NONE")
    .map((k) => ({ name: APP_STATUS_LABEL[k], value: counts[k], key: k }));
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        No activity yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          strokeWidth={0}
          isAnimationActive={!reduce}
          animationBegin={0}
          animationDuration={700}
          animationEasing="ease-out"
        >
          {data.map((d) => (
            <Cell key={d.key} fill={COLORS[d.key]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => (
            <span className="text-muted-foreground">{v}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
