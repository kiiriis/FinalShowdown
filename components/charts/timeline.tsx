"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useReducedMotion } from "framer-motion";
import { userSeriesColor } from "@/lib/chart-colors";
import { ChartTooltip } from "./chart-tooltip";

export function Timeline({
  data,
  users,
}: {
  data: Array<Record<string, string | number>>;
  users: Array<{ id: string; displayName: string }>;
}) {
  const reduce = useReducedMotion();
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        No jobs added in the last 90 days
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          {users.map((u, i) => (
            <linearGradient
              key={u.id}
              id={`g-${u.id}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={userSeriesColor(i)}
                stopOpacity={0.45}
              />
              <stop
                offset="95%"
                stopColor={userSeriesColor(i)}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d) => String(d).slice(5)}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: "hsl(var(--border))" }}
          content={<ChartTooltip />}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        {users.map((u, i) => (
          <Area
            key={u.id}
            type="monotone"
            dataKey={u.id}
            name={u.displayName}
            stroke={userSeriesColor(i)}
            fill={`url(#g-${u.id})`}
            strokeWidth={2}
            stackId="1"
            isAnimationActive={!reduce}
            animationBegin={0}
            animationDuration={700}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
