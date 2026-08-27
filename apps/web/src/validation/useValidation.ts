import { useMemo } from 'react';
import { useEditorStore } from '../state/editorStore';
import { validateResume, type ValidationIssue } from './schema';

export function useValidation(): ValidationIssue[] {
  const resume = useEditorStore((s) => s.resume);
  return useMemo(() => validateResume(resume), [resume]);
}
