"use client";

import * as React from "react";

type Item = {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: { fill?: string };
};

// Shared custom tooltip for every Recharts chart — token-styled card, mono
// tabular values, series dot carrying the identity color. Zero-value rows are
// hidden so stacked charts don't list every quiet series.
export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  hideZero = true,
}: {
  active?: boolean;
  payload?: Item[];
  label?: string | number;
  formatLabel?: (label: string | number) => React.ReactNode;
  hideZero?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = hideZero ? payload.filter((p) => Number(p.value) > 0) : payload;
  if (rows.length === 0) return null;
  return (
    <div className="min-w-[9.5rem] rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      {label !== undefined && label !== "" && (
        <div className="mb-1.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
          {formatLabel ? formatLabel(label) : String(label)}
        </div>
      )}
      <div className="space-y-1">
        {rows.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: p.color ?? p.payload?.fill }}
              aria-hidden
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-mono font-medium tabular-nums">
              {Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
