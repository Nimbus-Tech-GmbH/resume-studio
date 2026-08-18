import { useStore } from 'zustand';
import { useEditorStore } from '../state/editorStore.js';
import { Button } from '../components/ui/button.js';
import { Undo2, Redo2 } from 'lucide-react';

export function UndoRedoButtons() {
  const canUndo = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0);

  const undo = () => useEditorStore.temporal.getState().undo();
  const redo = () => useEditorStore.temporal.getState().redo();

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        className="h-8 w-8"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        className="h-8 w-8"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
