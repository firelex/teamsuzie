import * as React from "react"

import { cn } from "../lib/utils"

export type StatusState = "online" | "offline" | "pending"

const DOT_COLOR: Record<StatusState, string> = {
  online: "bg-emerald-500",
  offline: "bg-destructive",
  pending: "bg-muted-foreground/50",
}

const DEFAULT_TITLES: Record<StatusState, string> = {
  online: "Runtime reachable",
  offline: "Runtime offline",
  pending: "Checking runtime",
}

/**
 * Inline status indicator: a colored dot + label, with a hover title that
 * explains what the state means. Designed for chat-app sidebar footers and
 * admin headers — anywhere the user wants a quick at-a-glance read on
 * upstream service health.
 */
export function StatusDot({
  name,
  state,
  title,
  className,
}: {
  name: string
  state: StatusState
  /** Override the default hover title. */
  title?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
      title={title ?? DEFAULT_TITLES[state]}
    >
      <span className={cn("size-1.5 rounded-full", DOT_COLOR[state])} aria-hidden="true" />
      <span className="font-medium text-foreground/80">{name}</span>
    </span>
  )
}
