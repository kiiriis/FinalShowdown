"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useReducedMotion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"];

type Granularity = "day" | "week" | "month";
type Row = Record<string, string | number>;

export function ApplicationsOverTime({
  series,
  users,
}: {
  series: { day: Row[]; week: Row[]; month: Row[] };
  users: Array<{ id: string; displayName: string }>;
}) {
  const [granularity, setGranularity] = React.useState<Granularity>("day");
  const data = series[granularity];
  const reduce = useReducedMotion();
  // animationBegin stays 0 on every series — staggering stacked bars desyncs them
  const anim = {
    isAnimationActive: !reduce,
    animationBegin: 0,
    animationDuration: 700,
    animationEasing: "ease-out" as const,
  };

  const empty = data.length === 0;
  // Sum per-user totals across visible range — shown as subtle footnote.
  const totals = React.useMemo(() => {
    const acc: Record<string, number> = {};
    for (const row of data) {
      for (const u of users) {
        acc[u.id] = (acc[u.id] ?? 0) + ((row[u.id] as number | undefined) ?? 0);
      }
    }
    return acc;
  }, [data, users]);
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs
          value={granularity}
          onValueChange={(v) => setGranularity(v as Granularity)}
        >
          <TabsList>
            <TabsTrigger value="day">Per day</TabsTrigger>
            <TabsTrigger value="week">Per week</TabsTrigger>
            <TabsTrigger value="month">Per month</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="text-xs text-muted-foreground">
          {grandTotal.toLocaleString()} applications shown ·{" "}
          {granularity === "day"
            ? "last 30 days"
            : granularity === "week"
              ? "last 26 weeks"
              : "last 12 months"}
        </div>
      </div>

      {empty ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          No applications yet in this range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="bucket"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatTick(String(v), granularity)}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(l) => formatTooltipLabel(String(l), granularity)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            {users.map((u, i) => (
              <Bar
                key={u.id}
                dataKey={u.id}
                name={u.displayName}
                stackId="apps"
                fill={COLORS[i % COLORS.length]}
                radius={
                  i === users.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                }
                {...anim}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function formatTick(raw: string, g: Granularity): string {
  if (g === "month") {
    const [y, m] = raw.split("-");
    return `${m}/${y.slice(2)}`;
  }
  if (g === "week") {
    return raw.slice(5); // MM-DD
  }
  return raw.slice(5); // MM-DD
}

function formatTooltipLabel(raw: string, g: Granularity): string {
  if (g === "month") return raw;
  if (g === "week") return `Week of ${raw}`;
  return raw;
}
