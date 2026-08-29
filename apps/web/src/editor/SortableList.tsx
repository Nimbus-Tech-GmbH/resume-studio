import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { type ReactNode, useId } from "react"

interface SortableListProps<T> {
  items: T[]
  getId: (item: T, index: number) => string
  onReorder: (next: T[], fromIndex: number, toIndex: number) => void
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const scope = useId()
  const ids = items.map((item, index) => `${scope}-${getId(item, index)}`)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    onReorder(arrayMove(items, oldIndex, newIndex), oldIndex, newIndex)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-w-0 flex-col gap-3">
          {items.map((item, index) => (
            <SortableRow key={ids[index]} id={ids[index]!}>
              {(handle) => renderItem(item, index, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

interface SortableRowProps {
  id: string
  children: (handle: ReactNode) => ReactNode
}

function SortableRow({ id, children }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  } as const

  const handle = (
    <span
      {...attributes}
      {...listeners}
      className="cursor-grab select-none text-muted-foreground hover:text-foreground"
      aria-label="Drag to reorder"
    >
      <GripVertical className="size-4" />
    </span>
  )

  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  )
}
