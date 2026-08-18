import { useStore } from 'zustand';
import { useEditorStore } from '../state/editorStore.js';

export function UndoRedoButtons() {
  const canUndo = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0);

  const undo = () => useEditorStore.temporal.getState().undo();
  const redo = () => useEditorStore.temporal.getState().redo();

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs disabled:opacity-40"
      >
        ↶
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs disabled:opacity-40"
      >
        ↷
      </button>
    </div>
  );
}
