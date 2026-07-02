"use client";

import * as React from "react";
import { Moon, Sun, Monitor, Check, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Fixed preview colors so the swatches always show what each theme looks
// like, independent of the currently active theme.
const THEMES = [
  { value: "light", label: "Paper", icon: Sun, bg: "#F5F6FA", fg: "#2C43C9" },
  {
    value: "graphite",
    label: "Graphite",
    icon: SunMoon,
    bg: "#232429",
    fg: "#8D9CFC",
  },
  { value: "dark", label: "Carbon", icon: Moon, bg: "#0C0D12", fg: "#8D9EFF" },
] as const;

function Swatch({ bg, fg }: { bg: string; fg: string }) {
  return (
    <span
      className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-foreground/20"
      style={{ background: bg }}
      aria-hidden
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: fg }}
      />
    </span>
  );
}

export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const active = mounted ? theme : undefined;
  const CurrentIcon = !mounted
    ? Sun
    : (THEMES.find((t) => t.value === (theme === "system" ? resolvedTheme : theme))
        ?.icon ?? Sun);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className="cursor-pointer gap-2"
          >
            <Swatch bg={t.bg} fg={t.fg} />
            {t.label}
            {active === t.value && <Check className="ml-auto h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="cursor-pointer gap-2"
        >
          <Monitor className="h-4 w-4 text-muted-foreground" />
          System
          {active === "system" && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
