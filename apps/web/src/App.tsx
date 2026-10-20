import type { ReactNode } from 'react';

import { StudioShell, type StudioShellProps } from '@/shell/StudioShell';
import { ResumeWorkspace } from '@/workspace/ResumeWorkspace';

function renderWorkspace(slots: StudioShellProps): ReactNode {
  return <StudioShell {...slots} />;
}

export function App() {
  return <ResumeWorkspace>{renderWorkspace}</ResumeWorkspace>;
}
