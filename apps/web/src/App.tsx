import { DEFAULT_THEME, THEMES, type ThemeId } from '@resume-studio/themes';
import { useEditorStore } from './state/editorStore.js';
import { useUndoRedoShortcuts } from './state/useUndoRedoShortcuts.js';
import { PreviewFrame } from './preview/PreviewFrame.js';
import { EditorPane } from './editor/EditorPane.js';
import { UndoRedoButtons } from './editor/UndoRedoButtons.js';
import { SaveButton } from './editor/SaveButton.js';
import { ValidationBanner } from './editor/ValidationBanner.js';
import { ResumePicker } from './editor/ResumePicker.js';

export function App() {
  useUndoRedoShortcuts();
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const resume = useEditorStore((s) => s.resume);

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">resume-studio</h1>
          <ResumePicker />
        </div>
        <div className="flex items-center gap-2">
          <UndoRedoButtons />
          <label className="text-xs text-neutral-500" htmlFor="theme-select">
            Theme
          </label>
          <select
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <SaveButton />
        </div>
      </header>
      <ValidationBanner />
      <main className="grid flex-1 grid-cols-2 gap-0 overflow-hidden">
        <section className="overflow-hidden border-r border-neutral-200 bg-neutral-50">
          <EditorPane />
        </section>
        <section className="overflow-hidden bg-neutral-100">
          <PreviewFrame resume={resume} theme={theme} />
        </section>
      </main>
      <footer className="border-t border-neutral-200 bg-white px-3 py-1 text-[10px] text-neutral-400">
        Default theme: <code>{DEFAULT_THEME}</code> · undo ⌘Z · redo ⌘⇧Z
      </footer>
    </div>
  );
}
