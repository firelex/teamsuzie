import * as React from "react"

import { cn } from "../lib/utils"

function AppShell({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="app-shell"
      className={cn(
        "flex h-screen bg-background text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AppShellMain({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="app-shell-main"
      className={cn("flex min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

function AppShellContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="app-shell-content"
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      {...props}
    />
  )
}

export { AppShell, AppShellMain, AppShellContent }
