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

const COLORS = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"];

export function Timeline({
  data,
  users,
}: {
  data: Array<Record<string, string | number>>;
  users: Array<{ id: string; displayName: string }>;
}) {
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
                stopColor={COLORS[i % COLORS.length]}
                stopOpacity={0.45}
              />
              <stop
                offset="95%"
                stopColor={COLORS[i % COLORS.length]}
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
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(l) => `Day ${l}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        {users.map((u, i) => (
          <Area
            key={u.id}
            type="monotone"
            dataKey={u.id}
            name={u.displayName}
            stroke={COLORS[i % COLORS.length]}
            fill={`url(#g-${u.id})`}
            strokeWidth={2}
            stackId="1"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
