import type { ReactNode } from "react"
import { Circle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PanelHeaderProps {
  title: string
  status?: "live" | "error" | "warning"
  statusLabel?: string
  className?: string
  action?: ReactNode
}

const statusStyles: Record<NonNullable<PanelHeaderProps["status"]>, string> = {
  live: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-red-500",
}

export function PanelHeader({ title, status, statusLabel, className, action }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center justify-between border-b bg-muted/40 px-3 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      <span className="truncate">{title}</span>
      {(status || action) && (
        <span className="flex items-center gap-1.5">
          {status && (
            <Circle className={cn("size-2 fill-current animate-pulse", statusStyles[status])} />
          )}
          {statusLabel && <span className="text-[0.625rem]">{statusLabel}</span>}
          {action}
        </span>
      )}
    </div>
  )
}
