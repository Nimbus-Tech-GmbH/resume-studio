import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PresentationInputV1 } from '@resume-studio/studio-contracts';
import {
  createHttpPresentationTransport,
  PreviewPresentation,
} from '@resume-studio/resume-presentation';
import { DEFAULT_THEME, THEMES, type ThemeId } from '@resume-studio/themes';
import { BadgeInfo, Code, FormInput, Palette, Upload } from 'lucide-react';

import { useAuth } from '@/auth/AuthContext';
import { PanelHeader } from '@/components/PanelHeader';
import { StartupDialog } from '@/components/StartupDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { TailoringPanel } from '@/features/ai-tailoring';
import { useTailoringStore } from '@/features/ai-tailoring/state/tailoringStore';
import { useWorkspaceRecovery } from './recovery';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EditorPane } from '@/editor/EditorPane';
import { ExportMenu } from '@/editor/ExportMenu';
import { JsonEditor, type JsonEditorHandle } from '@/editor/JsonEditor';
import { ResumePicker } from '@/editor/ResumePicker';
import { ValidationBanner } from '@/editor/ValidationBanner';
import type { StudioShellProps } from '@/shell/StudioShell';
import { useEditorStore } from '@/state/editorStore';
import { useValidation } from '@/validation/useValidation';
import { logoutAndReset } from './logout';

type PreviewStatus = 'live' | 'error' | 'warning';
type ViewMode = 'form' | 'json';

const presentationTransport = createHttpPresentationTransport({
  endpoint: import.meta.env.VITE_RENDER_ENDPOINT ?? 'http://localhost:8787',
});

interface ResumeWorkspaceProps {
  children: (slots: StudioShellProps) => ReactNode;
}

export function ResumeWorkspace({ children }: ResumeWorkspaceProps) {
  const resume = useEditorStore((state) => state.resume);
  const documentKey = useEditorStore((state) => state.documentKey);
  const documentRevision = useEditorStore((state) => state.documentRevision);
  const theme = useEditorStore((state) => state.theme);
  const setIsStartup = useEditorStore((state) => state.setIsStartup);
  const resetAll = useEditorStore((state) => state.resetAll);
  const recoveryStatus = useEditorStore((state) => state.recoveryStatus);
  const revision = useEditorStore((state) => state.revision);
  const workspaceLoadState = useEditorStore((state) => state.workspaceLoadState);
  const lastApplied = useTailoringStore((state) => state.lastApplied);
  const issues = useValidation();
  const { isAuthenticated, login, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const { startupDialogOpen } = useWorkspaceRecovery();

  const presentationInput = useMemo<PresentationInputV1 | null>(() => {
    if (documentKey === null) {
      return null;
    }

    return {
      contractVersion: 1,
      document: {
        key: documentKey,
        revision: documentRevision,
        resume,
      },
      themeId: theme,
    };
  }, [documentKey, documentRevision, resume, theme]);

  const handleLogout = useCallback(() => logoutAndReset(resetAll, logout), [logout, resetAll]);

  const name = resume.basics?.name || 'Untitled';
  const pdfName = `${name.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  const previewStatus = getPreviewStatus(issues);
  const isEmpty = documentKey === null;

  return children({
    session: {
      isAuthenticated,
      onLogin: login,
      onLogout: handleLogout,
    },
    documentSelector: <ResumePicker />,



    aiChat: <TailoringPanel />,
    workspaceBadges: (
      <WorkspaceBadges
        recoveryStatus={recoveryStatus}
        revision={revision}
        workspaceLoadState={workspaceLoadState}
        hasAppliedBatch={lastApplied !== null}
        isAuthenticated={isAuthenticated}
      />
    ),
    validationStatus: <ValidationBanner />,
    editor: <EditorPanel name={name} empty={isEmpty} viewMode={viewMode} onViewModeChange={setViewMode} />,
    preview: <PreviewPanel pdfName={pdfName} status={previewStatus} input={presentationInput} actions={<div className="flex items-center gap-1"><ResumeThemeControl /><ExportMenu /></div>} />,
    startup: <StartupDialog open={startupDialogOpen} onOpenChange={setIsStartup} />,
  });
}

function WorkspaceBadges({
  recoveryStatus,
  revision,
  workspaceLoadState,
  hasAppliedBatch,
  isAuthenticated,
}: {
  recoveryStatus: ReturnType<typeof useEditorStore.getState>['recoveryStatus'];
  revision: number;
  workspaceLoadState: ReturnType<typeof useEditorStore.getState>['workspaceLoadState'];
  hasAppliedBatch: boolean;
  isAuthenticated: boolean;
}) {
  return (
    <>
      {recoveryStatus === 'recovered' ? <Badge variant="outline">Recovered locally</Badge> : null}
      {workspaceLoadState === 'ready' && revision > 0 ? (
        <Badge variant="outline">Modified</Badge>
      ) : null}
      {hasAppliedBatch ? <Badge variant="outline">Applied to draft</Badge> : null}
      {isAuthenticated ? (
        <>
          <Badge title="Saving is disabled — changes won't persist." variant="outline">
            <BadgeInfo data-icon="inline-start" />
            Save disabled
          </Badge>
          <span className="bg-border h-4 w-px" aria-hidden="true" />
        </>
      ) : null}
    </>
  );
}

function getPreviewStatus(issues: ReturnType<typeof useValidation>): PreviewStatus {
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'error';
  }

  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'warning';
  }

  return 'live';
}

function WorkspacePanel({
  title,
  status,
  empty,
  children,
  action,
}: {
  title: string;
  status?: PreviewStatus;
  empty: boolean;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PanelHeader title={title} status={empty ? undefined : status} action={action} />
      <div className="min-h-0 flex-1 overflow-hidden">
        {empty ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No resume selected</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function EditorPanel({
  name,
  empty,
  viewMode,
  onViewModeChange,
}: {
  name: string;
  empty: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const jsonEditorRef = useRef<JsonEditorHandle>(null);

  return (
    <WorkspacePanel
      title={name}
      empty={empty}
      action={
        <EditorModeControl mode={viewMode} onModeChange={onViewModeChange} jsonEditorRef={jsonEditorRef}/>
      }
    >
      {viewMode === 'json' ? <JsonEditor ref={jsonEditorRef} /> : <EditorPane />}
    </WorkspacePanel>
  );
}

function PreviewPanel({
  pdfName,
  status,
  input,
  actions,
}: {
  pdfName: string;
  status: PreviewStatus;
  input: PresentationInputV1 | null;
  actions: ReactNode;
}) {
  return (
    <WorkspacePanel title={pdfName} status={status} empty={input === null} action={actions}>
      {input === null ? null : (
        <div className="h-full overflow-y-auto p-6">
          <PreviewPresentation
            key={input.document.key}
            input={input}
            transport={presentationTransport}
            className="resume-workspace-presentation"
            autoHeight
          />
        </div>
      )}
    </WorkspacePanel>
  );
}

function EditorModeControl({
  mode,
  onModeChange,
  jsonEditorRef
}: {
  mode: ViewMode;
    onModeChange: (mode: ViewMode) => void;
    jsonEditorRef: React.RefObject<JsonEditorHandle | null>
}) {
  return (
    <ButtonGroup>
      <Button
        variant="outline"
        size="icon"
        className="cursor-pointer"
        onClick={() => jsonEditorRef.current?.openFilePicker()}
        title="Upload JSON resume"
        aria-label="Upload JSON resume"
      >
        <Upload />
      </Button>
      <ModeButton title="JSON editor" onClick={() => onModeChange('json')}>
        <Code className={mode === 'json' ? "text-destructive" : "text-default"} />
      </ModeButton>
      <ModeButton title="Form editor" onClick={() => onModeChange('form')}>
        <FormInput className={mode === 'form' ? "text-destructive" : "text-default"} />
      </ModeButton>
    </ButtonGroup>
  );
}

function ModeButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      className="cursor-pointer"
      size="icon"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  );
}

function ResumeThemeControl() {
  const theme = useEditorStore((state) => state.theme);
  const setTheme = useEditorStore((state) => state.setTheme);
  const activeTheme = THEMES.find((candidate) => candidate.id === theme)?.label ?? DEFAULT_THEME;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="cursor-pointer text-primary" size="xs">
          <Palette />
          {activeTheme}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Resume theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemeId)}>
          {THEMES.map((candidate) => (
            <DropdownMenuRadioItem key={candidate.id} value={candidate.id}>
              {candidate.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
