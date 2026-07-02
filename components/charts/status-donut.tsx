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
import { STATUS_CHART_COLORS } from "@/lib/chart-colors";
import { ChartTooltip } from "./chart-tooltip";

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
            <Cell
              key={d.key}
              fill={STATUS_CHART_COLORS[d.key]}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
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
