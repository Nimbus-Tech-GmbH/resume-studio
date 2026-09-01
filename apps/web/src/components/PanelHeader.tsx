import { Circle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PanelHeaderProps {
  title: string
  status?: "live" | "error" | "warning"
  className?: string
}

const statusStyles: Record<NonNullable<PanelHeaderProps["status"]>, string> = {
  live: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-red-500",
}

export function PanelHeader({ title, status, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center justify-between border-b bg-muted/40 px-3 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      <span className="truncate">{title}</span>
      {status && (
        <span className="flex items-center gap-1.5">
          <Circle className={cn("size-2 fill-current", statusStyles[status])} />
        </span>
      )}
    </div>
  )
}
