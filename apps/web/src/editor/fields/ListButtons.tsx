import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"

export function AddButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Button variant="default" onClick={onClick}>
      <Plus className="size-4" />
      {label}
    </Button>
  )
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Remove item"
      title="Remove"
      onClick={onClick}
    >
      <X className="size-4" />
    </Button>
  )
}
