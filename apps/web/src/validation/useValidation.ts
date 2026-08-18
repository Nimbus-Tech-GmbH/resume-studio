import { useMemo } from 'react';
import { useEditorStore } from '../state/editorStore.js';
import { validateResume, type ValidationIssue } from './schema.js';

export function useValidation(): ValidationIssue[] {
  const resume = useEditorStore((s) => s.resume);
  return useMemo(() => validateResume(resume), [resume]);
}
