import { useState, type ReactNode } from "react"
import { DEFAULT_THEME, THEMES, type ThemeId } from "@resume-studio/themes"
import { Palette } from "lucide-react"

import { useEditorStore } from "@/state/editorStore"
import { useValidation } from "@/validation/useValidation"
import { useMediaQuery } from "@/hooks/use-media-query"
import { PreviewFrame } from "@/preview/PreviewFrame"
import { EditorPane } from "@/editor/EditorPane"
import { SaveButton } from "@/editor/SaveButton"
import { PrintButton } from "@/editor/PrintButton"
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
import { PanelHeader } from "@/components/PanelHeader"

// ─── Derived state selectors ────────────────────────────────────────────────

function useResumeMeta() {
  const resume = useEditorStore((s) => s.resume)
  const resumeId = useEditorStore((s) => s.resumeId)
  const isStartup = useEditorStore((s) => s.isStartup)
  const issues = useValidation()

  const name = resume.basics?.name || "Untitled"
  const pdfName = name.toLowerCase().replace(/\s+/g, "-") + ".pdf"
  const previewStatus: "live" | "error" | "warning" = issues.some((i) => i.severity === "error")
    ? "error"
    : issues.some((i) => i.severity === "warning")
      ? "warning"
      : "live"

  return { resume, resumeId, isStartup, name, pdfName, previewStatus }
}

// ─── Panel content components ───────────────────────────────────────────────

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

interface PanelShellProps {
  header: ReactNode
  children: ReactNode
}

function PanelShell({ header, children }: PanelShellProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {header}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}

function EditorPanel({ name, isEmpty }: { name: string; isEmpty: boolean }) {
  return (
    <PanelShell header={<PanelHeader title={name} />}>
      {isEmpty ? <EmptyPanel label="No resume selected" /> : <EditorPane />}
    </PanelShell>
  )
}

function PreviewPanel({
  pdfName,
  resume,
  theme,
  previewStatus,
  isEmpty,
}: {
  pdfName: string
  resume: ReturnType<typeof useEditorStore.getState>["resume"]
  theme: ThemeId
  previewStatus: "live" | "error" | "warning"
  isEmpty: boolean
}) {
  return (
    <PanelShell header={<PanelHeader title={pdfName} status={isEmpty ? undefined : previewStatus} />}>
      {isEmpty ? (
        <EmptyPanel label="No resume selected" />
      ) : (
        <div className="h-full p-6">
          <PreviewFrame resume={resume} theme={theme} />
        </div>
      )}
    </PanelShell>
  )
}

const MOBILE_TABS = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
] as const

type MobileTabId = (typeof MOBILE_TABS)[number]["id"]

// ─── App ────────────────────────────────────────────────────────────────────

const noop = () => {}

export function App() {
  const theme = useEditorStore((s) => s.theme)
  const setTheme = useEditorStore((s) => s.setTheme)
  const isStartup = useEditorStore((s) => s.isStartup)
  const { resume, resumeId, name, pdfName, previewStatus } = useResumeMeta()

  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [mobileTab, setMobileTab] = useState<MobileTabId>("editor")

  const activeTheme =
    THEMES.find((c) => c.id === theme)?.label ?? DEFAULT_THEME

  const isEmpty = !resumeId

  const panelProps = { resume, theme, pdfName, previewStatus, isEmpty }

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <Header activeTheme={activeTheme} theme={theme} setTheme={setTheme} />

        <ValidationBanner />

        <main className="min-h-0 flex-1 overflow-hidden px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="border-border bg-background h-full overflow-hidden rounded-xl border shadow-sm">
            {isDesktop ? (
              <ResizablePanelGroup orientation="horizontal" autoSave="editor-layout">
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <EditorPanel name={name} isEmpty={isEmpty} />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <PreviewPanel {...panelProps} />
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              <MobileLayout
                mobileTab={mobileTab}
                setMobileTab={setMobileTab}
                name={name}
                {...panelProps}
              />
            )}
          </div>
        </main>
      </div>
      <StartupDialog open={isStartup} onOpenChange={noop} />
      <Toaster />
    </TooltipProvider>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface HeaderProps {
  activeTheme: string
  theme: ThemeId
  setTheme: (t: ThemeId) => void
}

function Header({ activeTheme, theme, setTheme }: HeaderProps) {
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
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <ThemePicker activeTheme={activeTheme} theme={theme} setTheme={setTheme} />
        <Separator orientation="vertical" />
        <PrintButton />
        <SaveButton />
      </div>
    </header>
  )
}

function ThemePicker({ activeTheme, theme, setTheme }: HeaderProps) {
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

interface MobileLayoutProps {
  mobileTab: MobileTabId
  setMobileTab: (tab: MobileTabId) => void
  name: string
  resume: ReturnType<typeof useEditorStore.getState>["resume"]
  theme: ThemeId
  pdfName: string
  previewStatus: "live" | "error" | "warning"
  isEmpty: boolean
}

function MobileLayout({
  mobileTab,
  setMobileTab,
  name,
  resume,
  theme,
  pdfName,
  previewStatus,
  isEmpty,
}: MobileLayoutProps) {
  return (
    <Tabs
      value={mobileTab}
      onValueChange={(v) => setMobileTab(v as MobileTabId)}
      className="flex h-full flex-col"
    >
      <TabsList variant="line" className="w-full shrink-0 justify-start border-b px-2">
        {MOBILE_TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="text-sm">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="min-h-0 flex-1">
        <TabsContent value="editor" className="h-full mt-0">
          <EditorPanel name={name} isEmpty={isEmpty} />
        </TabsContent>
        <TabsContent value="preview" className="h-full mt-0">
          <PreviewPanel
            resume={resume}
            theme={theme}
            pdfName={pdfName}
            previewStatus={previewStatus}
            isEmpty={isEmpty}
          />
        </TabsContent>
      </div>
    </Tabs>
  )
}
