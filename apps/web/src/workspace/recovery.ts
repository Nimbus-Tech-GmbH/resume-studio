import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useEditorStore } from '@/state/editorStore';
import { useTailoringStore } from '@/features/ai-tailoring/state/tailoringStore';
import { clearTailoringApiKey } from '@/features/ai-tailoring/credentialStore';
import { clearWorkspace, loadWorkspace, saveWorkspace } from './repository';
import { isLogoutTransition, isScopeHydrated, resolveStartupAfterRestore, shouldShowStartupDialog } from './hydration';
import type { PersistedWorkspaceRecord } from './schema';

function scopeForUser(isAuthenticated: boolean, userId: string | null): string {
  if (!isAuthenticated) return 'guest';
  return `account:${userId ?? 'unknown'}`;
}

function buildPersistedRecord(scope: string): PersistedWorkspaceRecord {
  const editor = useEditorStore.getState();
  const tailoring = useTailoringStore.getState();

  return {
    version: 1,
    scope,
    updatedAt: Date.now(),
    editor: {
      resume: editor.resume,
      original: editor.original,
      originalCms: editor.originalCms,
      cmsIds: editor.cmsIds,
      originalCmsIds: editor.originalCmsIds,
      theme: editor.theme,
      resumeId: editor.resumeId,
      loadedUpdatedAt: editor.loadedUpdatedAt,
      isStartup: editor.isStartup,
      workspaceLoadState: editor.workspaceLoadState,
      documentEpoch: editor.documentEpoch,
      revision: editor.revision,
      editorIds: editor.editorIds,
      jsonBuffer: editor.jsonBuffer,
    },
    tailoring: {
      workspaceId: tailoring.workspaceId,
      jobText: tailoring.jobText,
      jobVersion: tailoring.jobVersion,
      answerVersion: tailoring.answerVersion,
      status: tailoring.status,
      errorMessage: tailoring.errorMessage,
      lastAnalysis: tailoring.lastAnalysis,
      proposalDecisions: tailoring.proposalDecisions,
      proposalEdits: tailoring.proposalEdits,
      connection: tailoring.connection,
      lastApplied: tailoring.lastApplied,
    },
  };
}

export function useWorkspaceRecovery(): { startupDialogOpen: boolean } {
  const { isAuthenticated, userId } = useAuth();
  const scope = useMemo(
    () => scopeForUser(isAuthenticated, userId),
    [isAuthenticated, userId],
  );

  const [hydratedScope, setHydratedScope] = useState<string | null>(null);
  const loadedScope = useRef<string | null>(null);
  const isStartup = useEditorStore((state) => state.isStartup);

  useEffect(() => {
    const previousScope = loadedScope.current;
    loadedScope.current = scope;

    // Logging out leaves the signed-in account, so its local workspace goes
    // away and the startup dialog has to reopen.
    const isLogout = isLogoutTransition(previousScope, scope);

    if (
      previousScope &&
      previousScope !== scope &&
      previousScope.startsWith('account:')
    ) {
      void clearWorkspace(previousScope);
      clearTailoringApiKey();
    }

    let canceled = false;

    const run = async () => {
      useEditorStore.setState({ recoveryStatus: 'recovering' });

      try {
        const record = await loadWorkspace(scope);
        if (canceled) return;

        if (record?.version === 1) {
          useEditorStore.setState({
            ...record.editor,
            isStartup: resolveStartupAfterRestore(
              isLogout,
              record.editor.isStartup,
            ),
            recoveryStatus: 'recovered',
          });
          useTailoringStore.setState({
            ...record.tailoring,
            panelOpen: false,
          });
        } else {
          useEditorStore.setState({ recoveryStatus: 'idle' });
        }
      } catch {
        if (!canceled) {
          useEditorStore.setState({ recoveryStatus: 'storage-error' });
        }
      } finally {
        if (!canceled) setHydratedScope(scope);
      }
    };

    void run();

    return () => {
      canceled = true;
    };
  }, [scope]);

  const hydrated = isScopeHydrated(hydratedScope, scope);

  useEffect(() => {
    if (!hydrated) return;

    let timeoutId: number | null = null;

    const scheduleSave = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        const record = buildPersistedRecord(scope);
        void saveWorkspace(record).catch(() => {
          useEditorStore.setState({ recoveryStatus: 'storage-error' });
        });
      }, 500);
    };

    scheduleSave();

    const unsubscribeEditor = useEditorStore.subscribe(() => {
      scheduleSave();
    });
    const unsubscribeTailoring = useTailoringStore.subscribe(() => {
      scheduleSave();
    });

    return () => {
      unsubscribeEditor();
      unsubscribeTailoring();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [scope, hydrated]);

  return { startupDialogOpen: shouldShowStartupDialog(isStartup, hydrated) };
}

export async function clearLocalWorkspace(scope: string): Promise<void> {
  await clearWorkspace(scope);
}

export function currentScopeFromAuth(isAuthenticated: boolean, userId: string | null): string {
  return scopeForUser(isAuthenticated, userId);
}
