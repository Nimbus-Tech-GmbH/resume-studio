import { DEFAULT_THEME, THEMES, type ThemeId } from '@resume-studio/themes';
import { useEditorStore } from './state/editorStore.js';
import { useUndoRedoShortcuts } from './state/useUndoRedoShortcuts.js';
import { PreviewFrame } from './preview/PreviewFrame.js';
import { EditorPane } from './editor/EditorPane.js';
import { UndoRedoButtons } from './editor/UndoRedoButtons.js';
import { SaveButton } from './editor/SaveButton.js';
import { PrintButton } from './editor/PrintButton.js';
import { ValidationBanner } from './editor/ValidationBanner.js';
import { ResumePicker } from './editor/ResumePicker.js';
import { Separator } from './components/ui/separator.js';
import { Badge } from './components/ui/badge.js';
import { TooltipProvider } from './components/ui/tooltip.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select.js';

export function App() {
  useUndoRedoShortcuts();
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const resume = useEditorStore((s) => s.resume);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="resume-studio" className="h-8 w-8 rounded-md" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">resume-studio</span>
              <span className="text-[10px] text-muted-foreground">Real-time resume editor</span>
            </div>
            <Separator orientation="vertical" className="mx-2 h-8" />
            <ResumePicker />
          </div>
          <div className="flex items-center gap-3">
            <UndoRedoButtons />
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Theme</span>
              <Select value={theme} onValueChange={(v) => setTheme(v as ThemeId)}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEMES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <PrintButton />
            <SaveButton />
          </div>
        </header>
        <ValidationBanner />
        <main className="grid flex-1 grid-cols-2 overflow-hidden">
          <section className="overflow-hidden border-r bg-muted/30">
            <EditorPane />
          </section>
          <section className="overflow-hidden bg-muted/50">
            <PreviewFrame resume={resume} theme={theme} />
          </section>
        </main>
        <footer className="flex h-7 shrink-0 items-center justify-between border-t bg-card px-6 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Default theme:</span>
            <Badge variant="secondary" className="text-[10px]">{DEFAULT_THEME}</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span>undo ⌘Z</span>
            <span>redo ⌘⇧Z</span>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
