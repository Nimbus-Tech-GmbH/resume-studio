import { DEFAULT_THEME, THEMES, type ThemeId } from "@resume-studio/themes"
import { Palette } from "lucide-react"

import { useEditorStore } from "@/state/editorStore"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"

export function App() {
  const theme = useEditorStore((state) => state.theme)
  const setTheme = useEditorStore((state) => state.setTheme)
  const resume = useEditorStore((state) => state.resume)

  const activeTheme =
    THEMES.find((candidate) => candidate.id === theme)?.label ?? DEFAULT_THEME

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost">resume-studio</Button>

            <Separator orientation="vertical" />

            <ResumePicker />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">
                  <Palette />
                  {activeTheme}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Resume theme</DropdownMenuLabel>
                <DropdownMenuSeparator />

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

        <main className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">
          <section className="min-w-0 overflow-hidden border-r">
            <EditorPane />
          </section>

          <section className="min-w-0 overflow-hidden p-6">
            <PreviewFrame resume={resume} theme={theme} />
          </section>
        </main>
      </div>
    </TooltipProvider>
  )
}
