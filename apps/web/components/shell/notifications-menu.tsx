"use client";

import { Bell } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cluster/ui";

/** Notifications bell. No feed is wired yet, so it shows an empty state. */
export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground"
        >
          <Bell className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 border-[var(--hairline)] shadow-none"
      >
        <DropdownMenuLabel className="px-3 py-2.5 text-sm font-medium">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
          <Bell className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">You’re all caught up</p>
          <p className="text-muted-foreground text-xs">
            New activity will show up here.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
