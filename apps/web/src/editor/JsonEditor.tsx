import { useEffect, useRef, useState } from "react"
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror"
import CodeMirror from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { githubLight, githubDark } from "@uiw/codemirror-theme-github"
import { Upload } from "lucide-react"
import { useTheme } from "next-themes"
import { useEditorStore } from "@/state/editorStore"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}

export function JsonEditor() {
  const resume = useEditorStore((s) => s.resume)
  const setResume = useEditorStore((s) => s.setResume)
  const { theme: uiTheme } = useTheme()
  const isDark = uiTheme === "dark"

  const [error, setError] = useState<string | null>(null)
  const isLocalEdit = useRef(false)
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [doc, setDoc] = useState(() => formatJson(resume))

  // Sync from store → editor when resume changes externally
  useEffect(() => {
    if (isLocalEdit.current) {
      isLocalEdit.current = false
      return
    }
    const formatted = formatJson(resume)
    setDoc(formatted)
    const view = editorRef.current?.view
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: formatted },
      })
    }
  }, [resume])

  const handleChange = (value: string) => {
    setDoc(value)
    try {
      const parsed = JSON.parse(value)
      setError(null)
      isLocalEdit.current = true
      setResume(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setDoc(text)
      try {
        const parsed = JSON.parse(text)
        setError(null)
        isLocalEdit.current = true
        setResume(parsed)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid JSON")
      }
    }
    reader.readAsText(file)
    // Reset input so re-uploading the same file triggers onChange
    e.target.value = ""
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">JSON</span>
        <Button
          variant="outline"
          size="lg"
          className="cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-3" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={doc}
          height="100%"
          theme={isDark ? githubDark : githubLight}
          extensions={[json()]}
          onChange={handleChange}
          onCreateEditor={(view) => {
            editorRef.current = { view }
          }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
          }}
          className="h-full overflow-auto [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
        />
      </div>

      {error && (
        <div
          className={cn(
            "shrink-0 border-t px-4 py-1.5 text-xs font-medium",
            "bg-destructive/10 text-destructive border-destructive/20",
          )}
        >
          {error}
        </div>
      )}
    </div>
  )
}
