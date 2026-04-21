import * as React from "react"

import { cn } from "../lib/utils"

function EmptyState({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center",
        className
      )}
      {...props}
    />
  )
}

function EmptyStateIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-icon"
      aria-hidden="true"
      className={cn(
        "mb-4 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function EmptyStateTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="empty-state-title"
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function EmptyStateDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-state-description"
      className={cn("mt-1 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function EmptyStateActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-actions"
      className={cn("mt-5 flex items-center justify-center gap-2", className)}
      {...props}
    />
  )
}

export {
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateActions,
}
