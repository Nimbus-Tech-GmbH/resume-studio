import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Save } from "lucide-react"

import { useEditorStore } from "@/state/editorStore"
import { executeSave } from "@/graphql/executeSave"
import { fetchResumeUpdatedAt } from "@/graphql/useResume"
import { useValidation } from "@/validation/useValidation"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function SaveButton() {
  const queryClient = useQueryClient()
  const validation = useValidation()
  const canSave = validation.every((issue) => issue.severity !== "error")

  const onClick = async () => {
    const store = useEditorStore.getState()

    if (!store.originalCms || !store.resumeId) {
      toast.error("No resume loaded")
      return
    }

    const { toCms } = await import("@resume-studio/transformer")

    const plan = toCms({
      current: store.resume,
      original: store.original,
      originalCms: store.originalCms,
      cmsIds: store.cmsIds,
      originalCmsIds: store.originalCmsIds,
      resumeId: store.resumeId,
    })

    if (plan.errors.length > 0) {
      toast.error(
        `${plan.errors.length} field error(s): ${plan.errors
          .map((error) => error.path)
          .join(", ")}`
      )
      return
    }

    if (plan.ops.length === 0) {
      toast.info("Nothing to save.")
      return
    }

    const liveUpdatedAt = await fetchResumeUpdatedAt(store.resumeId)

    if (
      liveUpdatedAt &&
      store.loadedUpdatedAt &&
      liveUpdatedAt !== store.loadedUpdatedAt
    ) {
      toast.error(
        "This resume changed on the server since you loaded it. Reload the resume and re-apply your edits."
      )
      return
    }

    const savePromise = (async () => {
      const results = await executeSave(plan.ops)
      const failed = results.filter((result) => !result.ok)

      if (failed.length > 0) {
        throw new Error(
          `${failed.length}/${results.length} op(s) failed.`
        )
      }

      return results
    })()

    await toast.promise(savePromise, {
      loading: "Saving…",
      success: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["resume", store.resumeId],
        })
        return "Saved successfully"
      },
      error: (error) =>
        error instanceof Error ? error.message : "Save failed",
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={!canSave}
      onClick={onClick}
    >
      {canSave ? <Save data-icon="inline-start" data-title="Save changes" /> : <Spinner data-icon="inline-start" />}
    </Button>
  )
}
