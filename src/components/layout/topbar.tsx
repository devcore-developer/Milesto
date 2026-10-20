"use client";

import * as React from "react";
import {
  Search,
  Bell,
  ChevronDown,
  Settings,
  User,
  LogOut,
  Sun,
  Moon,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  CircleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Breadcrumbs } from "./breadcrumbs";
import { MobileNav } from "./mobile-nav";
import { notifications } from "@/data/notifications";
import { cn } from "@/lib/utils";

const toneIcon = {
  info: { icon: Info, className: "text-info" },
  success: { icon: CheckCircle2, className: "text-success" },
  warning: { icon: AlertTriangle, className: "text-warning" },
  danger: { icon: CircleAlert, className: "text-danger" },
} as const;

export function Topbar() {
  const unreadCount = notifications.length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <MobileNav />

      <div className="hidden min-w-0 md:block">
        <Breadcrumbs />
      </div>

      {/* Search */}
      <div className="relative ml-auto hidden w-full max-w-xs sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search projects, tasks, notes…"
          className="h-9 pl-9 pr-12"
          aria-label="Search"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground md:inline-flex">
          ⌘K
        </kbd>
      </div>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger ring-2 ring-background"
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">Notifications</p>
              <Badge variant="neutral" className="normal-case">{unreadCount} new</Badge>
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((n) => {
                const cfg = toneIcon[n.tone];
                const Icon = cfg.icon;
                return (
                  <li key={n.id} className="border-b border-border/60 px-3 py-2.5 last:border-0 hover:bg-accent/40">
                    <div className="flex gap-2.5">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.className)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">{n.title}</p>
                        <p className="mt-0.5 text-2xs text-muted-foreground text-pretty">{n.description}</p>
                        <p className="mt-1 text-2xs text-muted-foreground/80">{n.time}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border p-2">
              <Button variant="ghost" size="sm" className="w-full justify-center text-xs">
                View all notifications
              </Button>
            </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme toggle (decorative — disabled in Phase 1) */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
        aria-label="Toggle theme (coming in a later phase)"
        disabled
        title="Dark mode arrives in a later phase"
      >
        <Sun className="h-[18px] w-[18px]" />
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 text-left transition-colors hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar>
              <AvatarFallback>MV</AvatarFallback>
            </Avatar>
            <span className="hidden flex-col leading-tight md:flex">
              <span className="text-xs font-medium text-foreground">Mara Vey</span>
              <span className="text-2xs text-muted-foreground">Workspace owner</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar>
              <AvatarFallback>MV</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">Mara Vey</p>
              <p className="truncate text-xs text-muted-foreground">mara@milesto.app</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="h-4 w-4" /> Profile
            <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="h-4 w-4" /> Settings
            <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <HelpCircle className="h-4 w-4" /> Help center
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger focus:text-danger">
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}