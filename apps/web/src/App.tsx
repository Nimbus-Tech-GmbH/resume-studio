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

export function App() {
  useUndoRedoShortcuts();
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const resume = useEditorStore((s) => s.resume);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="resume-studio" className="h-6 w-6 rounded" />
            <h1 className="text-sm font-semibold tracking-tight">resume-studio</h1>
            <Separator orientation="vertical" className="h-5" />
            <ResumePicker />
          </div>
          <div className="flex items-center gap-2">
            <UndoRedoButtons />
            <Separator orientation="vertical" className="h-5" />
            <label className="text-xs text-muted-foreground">Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeId)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <Separator orientation="vertical" className="h-5" />
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
        <footer className="flex h-6 shrink-0 items-center justify-between border-t bg-card px-3 text-[10px] text-muted-foreground">
          <span>
            Default: <Badge variant="secondary">{DEFAULT_THEME}</Badge>
          </span>
          <span>undo ⌘Z · redo ⌘⇧Z</span>
        </footer>
      </div>
    </TooltipProvider>
  );
}
