"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Trophy,
  LayoutDashboard,
  Briefcase,
  LogOut,
  RefreshCw,
  MessageSquareText,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { initials } from "@/lib/utils";

type Props = {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    displayName?: string | null;
  };
};

const LINKS = [
  { href: "/", label: "Jobs", icon: Briefcase },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function Nav({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshing, startTransition] = React.useTransition();
  const name = user.displayName || user.name || "Player";
  useLiveRefresh(user.id);

  function refresh() {
    startTransition(() => {
      router.refresh();
      toast.success("Refreshed", { duration: 1200 });
    });
  }
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-lg">
      <div className="container flex h-14 items-center gap-2">
        <Link href="/" className="flex items-center gap-2.5 group mr-2">
          <span className="rounded-md bg-primary p-1.5 text-primary-foreground transition-transform duration-200 group-hover:-rotate-6">
            <Trophy className="h-4 w-4" />
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight">
            Final Showdown
          </span>
        </Link>
        <nav className="flex items-center gap-1 ml-2">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-md bg-muted -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh data"
            title="Refresh data"
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Account menu"
              >
                <Avatar>
                  {user.image && <AvatarImage src={user.image} alt={name} />}
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-semibold">{name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/settings/templates">
                  <MessageSquareText className="h-4 w-4 mr-2" /> Message
                  templates
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
