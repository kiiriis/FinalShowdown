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

type Row = {
  name: string;
  Applied: number;
  Referred: number;
  Skipped: number;
  Rejected: number;
  Offer: number;
};

export function UserBar({ data }: { data: Row[] }) {
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
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Bar dataKey="Applied" stackId="a" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
        <Bar
          dataKey="Referred"
          stackId="a"
          fill="#8b5cf6"
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="Skipped"
          stackId="a"
          fill="#71717a"
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="Rejected"
          stackId="a"
          fill="#f43f5e"
          radius={[2, 2, 0, 0]}
        />
        <Bar dataKey="Offer" stackId="a" fill="#10b981" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
