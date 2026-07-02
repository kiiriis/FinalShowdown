"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useReducedMotion } from "framer-motion";
import { STATUS_CHART_COLORS } from "@/lib/chart-colors";
import { ChartTooltip } from "./chart-tooltip";

type Row = {
  name: string;
  Applied: number;
  Referred: number;
  Skipped: number;
  Rejected: number;
  Offer: number;
};

export function UserBar({ data }: { data: Row[] }) {
  const reduce = useReducedMotion();
  // animationBegin stays 0 on every series — staggering stacked bars desyncs them
  const anim = {
    isAnimationActive: !reduce,
    animationBegin: 0,
    animationDuration: 700,
    animationEasing: "ease-out" as const,
  };
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={2} barSize={14}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--foreground) / 0.06)" }}
          content={<ChartTooltip />}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Bar
          dataKey="Applied"
          stackId="a"
          fill={STATUS_CHART_COLORS.APPLIED}
          radius={[2, 2, 0, 0]}
          {...anim}
        />
        <Bar
          dataKey="Referred"
          stackId="a"
          fill={STATUS_CHART_COLORS.APPLIED_WITH_REFERRAL}
          radius={[2, 2, 0, 0]}
          {...anim}
        />
        <Bar
          dataKey="Skipped"
          stackId="a"
          fill={STATUS_CHART_COLORS.SKIPPED}
          radius={[2, 2, 0, 0]}
          {...anim}
        />
        <Bar
          dataKey="Rejected"
          stackId="a"
          fill={STATUS_CHART_COLORS.REJECTED}
          radius={[2, 2, 0, 0]}
          {...anim}
        />
        <Bar
          dataKey="Offer"
          stackId="a"
          fill={STATUS_CHART_COLORS.OFFER}
          radius={[2, 2, 0, 0]}
          {...anim}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
