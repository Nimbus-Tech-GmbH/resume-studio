import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type ReactNode, useId } from 'react';

/**
 * Generic drag-and-drop wrapper for reorderable lists. The caller supplies:
 *   - `items`: array of items with stable string keys.
 *   - `getId`: derive the stable key.
 *   - `onReorder`: called with the new array after a drag ends.
 *   - `renderItem`: render each item; the DnD handle is a small dedicated span.
 */
interface SortableListProps<T> {
  items: T[];
  getId: (item: T, idx: number) => string;
  onReorder: (next: T[], from: number, to: number) => void;
  renderItem: (item: T, idx: number, handle: ReactNode) => ReactNode;
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const scope = useId();
  const ids = items.map((it, i) => `${scope}-${getId(it, i)}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(items, oldIdx, newIdx), oldIdx, newIdx);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <SortableRow key={ids[idx]} id={ids[idx]!}>
              {(handle) => renderItem(item, idx, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableRowProps {
  id: string;
  children: (handle: ReactNode) => ReactNode;
}

function SortableRow({ id, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  } as const;

  const handle = (
    <span
      {...attributes}
      {...listeners}
      className="cursor-grab select-none px-1 text-neutral-400 hover:text-neutral-600"
      aria-label="Drag to reorder"
    >
      ⋮⋮
    </span>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}
