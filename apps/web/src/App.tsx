import { useState } from "react"
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
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { PanelHeader } from "@/components/PanelHeader"

export function App() {
  const theme = useEditorStore((state) => state.theme)
  const setTheme = useEditorStore((state) => state.setTheme)
  const resume = useEditorStore((state) => state.resume)
  const issues = useValidation()

  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor")

  const resumeName = resume.basics?.name || "Untitled"
  const pdfName = resumeName.toLowerCase().replace(/\s+/g, "-") + ".pdf"
  const hasErrors = issues.some((i) => i.severity === "error")
  const hasWarnings = issues.some((i) => i.severity === "warning")
  const previewStatus = hasErrors ? "error" : hasWarnings ? "warning" : "live"

  const activeTheme =
    THEMES.find((candidate) => candidate.id === theme)?.label ?? DEFAULT_THEME

  const editorContent = (
    <div className="flex h-full flex-col overflow-hidden">
      <PanelHeader title={resumeName} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <EditorPane />
      </div>
    </div>
  )

  const previewContent = (
    <div className="flex h-full flex-col overflow-hidden">
      <PanelHeader title={pdfName} status={previewStatus} />
      <div className="min-h-0 flex-1 overflow-hidden p-6">
        <PreviewFrame resume={resume} theme={theme} />
      </div>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar size="lg">
              <AvatarImage src="./logo.png"/>
            </Avatar>
            <Button variant="ghost">
              <span className="text-primary text-lg">resume-studio</span>
            </Button>

            <Separator orientation="vertical" />

            <ResumePicker />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-primary">
                  <Palette />
                  {activeTheme}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Resume theme</DropdownMenuLabel>

                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(value) => setTheme(value as ThemeId)}
                >
                  {THEMES.map((candidate) => (
                    <DropdownMenuRadioItem
                      key={candidate.id}
                      value={candidate.id}
                    >
                      {candidate.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" />

            <PrintButton />
            <SaveButton />
          </div>
        </header>

        <ValidationBanner />

        <main className="min-h-0 flex-1 overflow-hidden px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="border-border bg-background h-full overflow-hidden rounded-xl border shadow-sm">
            {isDesktop ? (
              <ResizablePanelGroup orientation="horizontal" autoSave="editor-layout">
                <ResizablePanel defaultSize="50%" minSize="20%">
                  {editorContent}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="50%" minSize="20%">
                  {previewContent}
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              <div className="flex h-full flex-col">
                <div className="border-border flex h-11 shrink-0 items-center justify-between border-b gap-2 px-3">
                  <div className="bg-muted/60 inline-flex rounded-md border p-0.5 text-[0.8125rem]">
                    {(["editor", "preview"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        data-active={mobileTab === value}
                        aria-pressed={mobileTab === value}
                        onClick={() => setMobileTab(value)}
                        className="data-[active=true]:bg-background data-[active=true]:text-foreground rounded-[5px] px-3 py-1 font-medium transition-colors data-[active=true]:shadow-sm"
                      >
                        {value === "editor" ? "Editor" : "Preview"}
                      </button>
                    ))}
                  </div>

                </div>
                <div className="min-h-0 flex-1">
                  {mobileTab === "editor" ? editorContent : previewContent}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <Toaster/>
    </TooltipProvider>
  )
}
