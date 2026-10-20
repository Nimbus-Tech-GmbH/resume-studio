import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { BadgeInfo, LogOut, Moon, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useMediaQuery } from '@/hooks/use-media-query';

const MOBILE_TABS = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Preview' },
] as const;

type MobileTabId = (typeof MOBILE_TABS)[number]['id'];

export interface StudioShellProps {
  session: {
    isAuthenticated: boolean;
    onLogin: () => Promise<void>;
    onLogout: () => Promise<void>;
  };
  documentSelector: ReactNode;
  editorModeControl: ReactNode;
  resumeThemeControl: ReactNode;
  exportActions: ReactNode;
  validationStatus: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
  startup: ReactNode;
}

export function StudioShell(props: StudioShellProps) {
  return (
    <ShellErrorBoundary>
      <TooltipProvider>
        <StudioFrame {...props} />
        {props.startup}
        <Toaster />
      </TooltipProvider>
    </ShellErrorBoundary>
  );
}

function StudioFrame({
  session,
  documentSelector,
  editorModeControl,
  resumeThemeControl,
  exportActions,
  validationStatus,
  editor,
  preview,
}: StudioShellProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [mobileTab, setMobileTab] = useState<MobileTabId>('editor');

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <StudioHeader
        session={session}
        documentSelector={documentSelector}
        editorModeControl={editorModeControl}
        resumeThemeControl={resumeThemeControl}
        exportActions={exportActions}
      />

      {validationStatus}

      <main className="min-h-0 flex-1 overflow-hidden px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="border-border bg-background h-full overflow-hidden rounded-xl border shadow-sm">
          {isDesktop ? (
            <DesktopLayout editor={editor} preview={preview} />
          ) : (
            <MobileLayout
              tab={mobileTab}
              onTabChange={setMobileTab}
              editor={editor}
              preview={preview}
            />
          )}
        </div>
      </main>
    </div>
  );
}

interface StudioHeaderProps {
  session: StudioShellProps['session'];
  documentSelector: ReactNode;
  editorModeControl: ReactNode;
  resumeThemeControl: ReactNode;
  exportActions: ReactNode;
}

function StudioHeader({
  session,
  documentSelector,
  editorModeControl,
  resumeThemeControl,
  exportActions,
}: StudioHeaderProps) {
  const { theme, setTheme } = useTheme();
  const handleAuthToggle = session.isAuthenticated ? session.onLogout : session.onLogin;

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar size="lg">
          <AvatarImage src="./logo.png" alt="Resume Studio" />
        </Avatar>
        <Button variant="ghost">
          <span className="text-primary text-lg">resume-studio</span>
        </Button>

        <Separator orientation="vertical" />
        {documentSelector}
        <Separator orientation="vertical" />
        {editorModeControl}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {session.isAuthenticated ? null : (
          <>
            <Badge
              title="Guest mode — changes won't persist. Sign in to save resumes."
              variant="outline"
            >
              <BadgeInfo data-icon="inline-start" />
              Guest mode
            </Badge>
            <Separator orientation="vertical" />
          </>
        )}
        <IconButton
          title="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </IconButton>
        {resumeThemeControl}
        <Separator orientation="vertical" />
        {exportActions}
        <IconButton title={session.isAuthenticated ? 'Logout' : 'Login'} onClick={handleAuthToggle}>
          {session.isAuthenticated ? (
            <LogOut className="size-3.5" />
          ) : (
            <User className="size-3.5" />
          )}
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} title={title} aria-label={title}>
      {children}
    </Button>
  );
}

function DesktopLayout({ editor, preview }: { editor: ReactNode; preview: ReactNode }) {
  return (
    <ResizablePanelGroup orientation="horizontal" autoSave="editor-layout">
      <ResizablePanel defaultSize="50%" minSize="20%">
        {editor}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="50%" minSize="20%">
        {preview}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function MobileLayout({
  tab,
  onTabChange,
  editor,
  preview,
}: {
  tab: MobileTabId;
  onTabChange: (tab: MobileTabId) => void;
  editor: ReactNode;
  preview: ReactNode;
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as MobileTabId)}
      className="flex h-full flex-col"
    >
      <TabsList variant="line" className="w-full shrink-0 justify-start border-b px-2">
        {MOBILE_TABS.map((mobileTab) => (
          <TabsTrigger key={mobileTab.id} value={mobileTab.id} className="text-sm">
            {mobileTab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="min-h-0 flex-1">
        <TabsContent value="editor" className="h-full mt-0">
          {editor}
        </TabsContent>
        <TabsContent value="preview" className="h-full mt-0">
          {preview}
        </TabsContent>
      </div>
    </Tabs>
  );
}

interface ShellErrorBoundaryState {
  error: Error | null;
}

class ShellErrorBoundary extends Component<{ children: ReactNode }, ShellErrorBoundaryState> {
  override state: ShellErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ShellErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Error details stay out of UI; React dev tooling retains diagnostics.
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 p-4">
          <div className="text-center">
            <h1 className="text-lg font-semibold text-destructive">Oops, something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">{this.state.error.message}</p>
          </div>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
