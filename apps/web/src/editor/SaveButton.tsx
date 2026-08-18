import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toCms } from '@resume-studio/transformer';
import { useEditorStore } from '../state/editorStore.js';
import { executeSave, type OpResult } from '../graphql/executeSave.js';
import { useValidation } from '../validation/useValidation.js';

interface SaveState {
  running: boolean;
  message: string | null;
  results: OpResult[];
}

export function SaveButton() {
  const [state, setState] = useState<SaveState>({ running: false, message: null, results: [] });
  const queryClient = useQueryClient();
  const validation = useValidation();
  const canSave = validation.length === 0;

  const onClick = async () => {
    const store = useEditorStore.getState();
    if (!store.originalCms || !store.resumeId) {
      setState({ running: false, message: 'No resume loaded', results: [] });
      return;
    }
    const plan = toCms({
      current: store.resume,
      original: store.original,
      originalCms: store.originalCms,
      cmsIds: store.cmsIds,
      originalCmsIds: store.originalCmsIds,
      resumeId: store.resumeId,
    });
    if (plan.errors.length > 0) {
      setState({
        running: false,
        message: `${plan.errors.length} field error(s): ${plan.errors
          .map((e) => e.path)
          .join(', ')}`,
        results: [],
      });
      return;
    }
    if (plan.ops.length === 0) {
      setState({ running: false, message: 'Nothing to save.', results: [] });
      return;
    }

    setState({ running: true, message: null, results: [] });
    const results = await executeSave(plan.ops);
    const failed = results.filter((r) => !r.ok);
    setState({
      running: false,
      message: failed.length === 0
        ? `Saved ${results.length} op(s).`
        : `${failed.length}/${results.length} op(s) failed.`,
      results,
    });
    if (failed.length === 0) {
      await queryClient.invalidateQueries({ queryKey: ['resume', store.resumeId] });
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={state.running || !canSave}
        className="rounded bg-neutral-900 px-3 py-1 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        title={canSave ? 'Save changes' : 'Fix validation errors first'}
      >
        {state.running ? 'Saving…' : 'Save'}
      </button>
      {state.message && (
        <span className="text-[10px] text-neutral-500">{state.message}</span>
      )}
    </div>
  );
}
