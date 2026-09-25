import { useState, type ReactNode } from "react"
import { DEFAULT_THEME, THEMES, type ThemeId } from "@resume-studio/themes"
import { BadgeInfo, Code, FormInput, LogOut, Moon, Palette, Sun, User } from "lucide-react"
import { useTheme } from "next-themes"

import { useAuth } from "@/auth/AuthContext"
import { useEditorStore } from "@/state/editorStore"
import { useValidation } from "@/validation/useValidation"
import { useMediaQuery } from "@/hooks/use-media-query"
import { PreviewFrame } from "@/preview/PreviewFrame"
import { EditorPane } from "@/editor/EditorPane"
import { JsonEditor } from "@/editor/JsonEditor"
import { ExportMenu } from "@/editor/ExportMenu"
import { ValidationBanner } from "@/editor/ValidationBanner"
import { ResumePicker } from "@/editor/ResumePicker"
import { StartupDialog } from "@/components/StartupDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { PanelHeader } from "@/components/PanelHeader"

// ─── Types ──────────────────────────────────────────────────────────────────

type PreviewStatus = "live" | "error" | "warning"
type ViewMode = "form" | "json"

const MOBILE_TABS = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
] as const

type MobileTabId = (typeof MOBILE_TABS)[number]["id"]

// ─── Shared layout pieces ───────────────────────────────────────────────────

function Panel({
  title,
  status,
  empty,
  emptyLabel,
  children,
}: {
  title: string
  status?: PreviewStatus
  empty: boolean
  emptyLabel: string
  children: ReactNode
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PanelHeader title={title} status={empty ? undefined : status} />
      <div className="min-h-0 flex-1 overflow-hidden">
        {empty ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function EditorPanel({ name, empty, viewMode }: { name: string; empty: boolean; viewMode: ViewMode }) {
  return (
    <Panel title={name} empty={empty} emptyLabel="No resume selected">
      {viewMode === "json" ? <JsonEditor /> : <EditorPane />}
    </Panel>
  )
}

function PreviewPanel({
  pdfName,
  resume,
  theme,
  status,
  empty,
}: {
  pdfName: string
  resume: ReturnType<typeof useEditorStore.getState>["resume"]
  theme: ThemeId
  status: PreviewStatus
  empty: boolean
}) {
  return (
    <Panel title={pdfName} status={status} empty={empty} emptyLabel="No resume selected">
      <div className="h-full p-6">
        <PreviewFrame resume={resume} theme={theme} />
      </div>
    </Panel>
  )
}

// ─── Layouts ────────────────────────────────────────────────────────────────

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
  )
}

function MobileLayout({
  tab,
  onTabChange,
  editor,
  preview,
}: {
  tab: MobileTabId
  onTabChange: (tab: MobileTabId) => void
  editor: ReactNode
  preview: ReactNode
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => onTabChange(v as MobileTabId)}
      className="flex h-full flex-col"
    >
      <TabsList variant="line" className="w-full shrink-0 justify-start border-b px-2">
        {MOBILE_TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="text-sm">
            {t.label}
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
  )
}

// ─── Header ─────────────────────────────────────────────────────────────────

function Header({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (m: ViewMode) => void }) {
  const { theme: uiTheme, setTheme: setUiTheme } = useTheme()
  const { isAuthenticated, login, logout } = useAuth()
  const resetAll = useEditorStore((s) => s.resetAll)

  const handleAuthToggle = () => {
    if (isAuthenticated) {
      resetAll()
      logout()
    } else {
      login()
    }
  }

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar size="lg">
          <AvatarImage src="./logo.png" />
        </Avatar>
        <Button variant="ghost">
          <span className="text-primary text-lg">resume-studio</span>
        </Button>

        <Separator orientation="vertical" />

        <ResumePicker />

        <Separator orientation="vertical" />

        <div className="flex items-center gap-0.5 rounded-md border p-0.5">
          <IconButton
            title="JSON editor"
            size="icon-xs"
            active={viewMode === "json"}
            onClick={() => setViewMode("json")}
          >
            <Code className="size-3.5" />
          </IconButton>
          <IconButton
            title="Form editor"
            size="icon-xs"
            active={viewMode === "form"}
            onClick={() => setViewMode("form")}
          >
            <FormInput className="size-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {isAuthenticated && (
          <>
            <Badge title="Saving is disabled — changes won't persist." variant="outline">
              <BadgeInfo data-icon="inline-start" />Save disabled
            </Badge>
            <Separator orientation="vertical" />
          </>
        )}
        <IconButton
          title="Toggle theme"
          onClick={() => setUiTheme(uiTheme === "dark" ? "light" : "dark")}
        >
          {uiTheme === "dark" ? (
            <Sun className="size-3.5" />
          ) : (
            <Moon className="size-3.5" />
          )}
        </IconButton>
        <ThemePicker />
        <Separator orientation="vertical" />
        <ExportMenu />
        <IconButton title={isAuthenticated ? "Logout" : "Login"} onClick={handleAuthToggle}>
          {isAuthenticated ? <LogOut className="size-3.5" /> : <User className="size-3.5" />}
        </IconButton>
      </div>
    </header>
  )
}

function IconButton({
  title,
  onClick,
  size = "icon-sm",
  active = false,
  children,
}: {
  title: string
  onClick: () => void
  size?: "icon-xs" | "icon-sm"
  active?: boolean
  children: ReactNode
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size={size}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  )
}

function ThemePicker() {
  const theme = useEditorStore((s) => s.theme)
  const setTheme = useEditorStore((s) => s.setTheme)
  const activeTheme = THEMES.find((c) => c.id === theme)?.label ?? DEFAULT_THEME

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="text-primary">
          <Palette />
          {activeTheme}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Resume theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeId)}>
          {THEMES.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id}>
              {c.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Derived state ──────────────────────────────────────────────────────────

function useAppModel() {
  const resume = useEditorStore((s) => s.resume)
  const resumeId = useEditorStore((s) => s.resumeId)
  const theme = useEditorStore((s) => s.theme)
  const isStartup = useEditorStore((s) => s.isStartup)
  const issues = useValidation()

  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [mobileTab, setMobileTab] = useState<MobileTabId>("editor")
  const [viewMode, setViewMode] = useState<ViewMode>("form")

  const name = resume.basics?.name || "Untitled"
  const pdfName = name.toLowerCase().replace(/\s+/g, "-") + ".pdf"
  const previewStatus: PreviewStatus = issues.some((i) => i.severity === "error")
    ? "error"
    : issues.some((i) => i.severity === "warning")
      ? "warning"
      : "live"
  const isEmpty = !resumeId && Object.keys(resume).length === 0

  return { resume, theme, isStartup, isDesktop, mobileTab, setMobileTab, viewMode, setViewMode, name, pdfName, previewStatus, isEmpty }
}

// ─── App ────────────────────────────────────────────────────────────────────

const noop = () => {}

export function App() {
  const {
    resume,
    theme,
    isStartup,
    isDesktop,
    mobileTab,
    setMobileTab,
    viewMode,
    setViewMode,
    name,
    pdfName,
    previewStatus,
    isEmpty,
  } = useAppModel()

  const editor = <EditorPanel name={name} empty={isEmpty} viewMode={viewMode} />
  const preview = (
    <PreviewPanel pdfName={pdfName} resume={resume} theme={theme} status={previewStatus} empty={isEmpty} />
  )

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <Header viewMode={viewMode} setViewMode={setViewMode} />

        <ValidationBanner />

        <main className="min-h-0 flex-1 overflow-hidden px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="border-border bg-background h-full overflow-hidden rounded-xl border shadow-sm">
            {isDesktop ? (
              <DesktopLayout editor={editor} preview={preview} />
            ) : (
              <MobileLayout tab={mobileTab} onTabChange={setMobileTab} editor={editor} preview={preview} />
            )}
          </div>
        </main>
      </div>
      <StartupDialog open={isStartup} onOpenChange={noop} />
      <Toaster />
    </TooltipProvider>
  )
}
