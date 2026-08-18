import { DEFAULT_THEME, THEMES, type ThemeId } from '@resume-studio/themes';
import { useEditorStore } from './state/editorStore.js';
import { PreviewFrame } from './preview/PreviewFrame.js';

export function App() {
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const resume = useEditorStore((s) => s.resume);

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
        <h1 className="text-sm font-semibold tracking-tight">resume-studio</h1>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            className="rounded bg-neutral-900 px-3 py-1 text-sm font-medium text-white hover:bg-neutral-700"
            disabled
            title="Save wired in milestone 7"
          >
            Save
          </button>
        </div>
      </header>
      <main className="grid flex-1 grid-cols-2 gap-0 overflow-hidden">
        <section className="overflow-y-auto border-r border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">
            Editor UI lands in milestone 4 (read-only) then milestone 5 (editing).
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            Default theme: <code>{DEFAULT_THEME}</code>
          </p>
        </section>
        <section className="overflow-hidden bg-neutral-100">
          <PreviewFrame resume={resume} theme={theme} />
        </section>
      </main>
    </div>
  );
}
