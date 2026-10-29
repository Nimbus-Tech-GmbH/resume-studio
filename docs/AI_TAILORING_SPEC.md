# AI Tailoring Specification

This document specifies the resume-tailoring feature. An implementing agent must build it from scratch.

## Goal

Let a user tailor their current editor resume against a job description using a locally running Ollama model. The feature produces a reviewable change ledger, identifies gaps, and applies only changes explicitly accepted by the user.

The feature must not automatically save to the CMS.

## Non-negotiable decisions

- Inference uses **only local Ollama**.
- Model invocation uses **only the Vercel AI SDK**.
- Inference executes in the **browser** and calls the user’s loopback Ollama endpoint directly.
- There is no cloud model provider, hosted inference broker, API-key-based model provider, server-side `/api/ai` proxy, provider fallback, or automatic retry.
- Do not call Ollama’s REST API directly; all model communication goes through the Vercel AI SDK.
- Use `generateObject` for the tailoring request. Do not use streaming.
- Use the JSON Resume MCP server at `https://jsonresume.org/mcp` for approved MCP tool calls.
- All AI UI must use shadcn components and the repository’s Tailwind v4 setup.

## Package boundary

Create one new package:

- `packages/ai`

`packages/ai` owns:

- Vercel AI SDK setup.
- Ollama provider construction.
- Prompt construction.
- MCP client integration.
- Request/response Zod schemas.
- Strict response validation.
- JSON Resume validation integration.
- Change-ledger modeling.
- Change grouping.
- Apply/undo transformation logic.
- Public typed API for `apps/web`.

`packages/ai` must not:

- Import `apps/web` internals.
- Access GraphQL, CMS IDs, auth state, or the database.
- Mutate the editor store directly.
- Automatically save a resume.
- Depend on another AI orchestration framework.

`apps/web` owns:

- The AI chat surface.
- Model selection.
- Job-description input.
- Loading, error, empty, and result states.
- Review and acceptance UI.
- Apply and Undo actions.
- Editor-store mutations.

## User flow

1. The user opens the AI tailoring chat.
2. The user selects an installed local Ollama model.
3. The user enters or pastes a job description.
4. The user submits the tailoring request.
5. The app builds a sanitized model copy of the current editor resume.
6. `packages/ai` invokes the selected Ollama model through the Vercel AI SDK using `generateObject`.
7. The response is validated against the strict response schema.
8. The returned `resume` is validated with `@jsonresume/schema`:
   ```ts
   import { validate } from '@jsonresume/schema';

   validate(resume, (errors, valid) => {
     if (!valid) {
       // fail closed
     }
   });
   ```
9. The chat displays the model response, the change ledger, and gaps.
10. The chat offers an **Apply** button after a valid LLM response.
11. Apply applies only user-accepted change groups to the editor document.
12. The preview reflects the mutated editor document.
13. Undo restores the exact pre-AI editor document.

## Inputs

The tailoring request contains:

- The current editor resume serialized as JSON Resume.
- The job description text.
- The selected local Ollama model identifier.

The app must remove contact fields listed in `WITHHELD_PATHS` from the copy sent to the model. After a successful response, those fields must be restored from the original editor resume.

`WITHHELD_PATHS` must include, at minimum:

- `basics.email`
- `basics.phone`
- `basics.website`
- `basics.location`
- `basics.profiles`

## Output contract

The model must return exactly one JSON object with exactly these top-level keys:

```ts
{
  resume: Resume;
  changes: Change[];
  gaps: Gap[];
}
```

No markdown fences, commentary, extra top-level keys, or missing keys are allowed.

### `resume`

`resume` is the accept-all preview. It is a complete JSON Resume object.

It must never directly replace the stored editor resume. It is displayed as a preview and may be used only after the user explicitly accepts the result.

### `changes`

Each change must be individually reviewable and must identify:

- A stable change ID.
- A change type.
- The affected resume section and entity.
- A human-readable summary.
- Enough information to apply or reject the change independently.

Allowed change types:

- Rewrite summary.
- Rewrite work summary.
- Rewrite work description.
- Rewrite work highlight.
- Rewrite project description.
- Rewrite project highlight.
- Narrow a label.
- Reorder skills.
- Delete a redundant work highlight.
- Delete a redundant project highlight.

### `gaps`

Each gap must identify a job-description requirement that the resume does not credibly demonstrate.

A gap must include:

- A stable gap ID.
- The requirement or keyword.
- A human-readable explanation.
- The reason it cannot be added from existing resume evidence.

The model must return gaps instead of inventing experience, employers, projects, certifications, education, dates, metrics, or skills.

## Content rules

The model may:

- Rewrite the resume summary.
- Rewrite work summaries, descriptions, and highlights.
- Rewrite project descriptions and highlights.
- Narrow labels to more relevant terminology.
- Reorder skills.
- Reorder content where allowed by the resume structure.
- Delete a highlight only when it is redundant with another retained highlight.

The model must not:

- Remove a role, project, certificate, education entry, volunteer entry, award, publication, language, interest, reference, or top-level section.
- Invent experience, employers, projects, certifications, education, dates, metrics, or skills.
- Add a job-description term unless the source resume already names that term or uses an unambiguous alias for it.
- Alter contact information.
- Change unknown or custom fields unless an explicit, reviewable change applies.
- Produce a resume that fails JSON Resume validation.

## MCP usage

Use the JSON Resume MCP server only for explicitly approved, read-only assistance:

- `validate_resume`
- `get_resume_schema`
- `check_ats`

Do not call write-capable or account-related MCP tools by default:

- `save_resume`
- `update_resume_section`
- `export_resume`
- `set_theme`
- `get_resume_analytics`
- `set_resume_source`
- `change_username`
- `set_explore_listing`
- Job marking tools
- OAuth/account management tools

The JSON Resume MCP server is remote and authenticated. Before using it, the UI must clearly tell the user that resume data will be sent to `jsonresume.org`, and the user must explicitly opt in. The default tailoring path must work without MCP.

MCP may be used to validate the model output or assess ATS readability. It must never be used to save, export, publish, or modify a user’s resume without a separate explicit user action.

## Failure behavior

The feature fails closed.

Do not silently truncate input, repair invalid JSON, split requests, retry with another model, fall back to a hosted provider, or apply partially valid output.

At minimum, detect and surface:

- Ollama unavailable.
- Selected model unavailable.
- Request context too large.
- Invalid or non-JSON model output.
- Missing or extra top-level response keys.
- JSON Resume validation failure.
- Semantic rule violation, such as a removed role or invented experience.
- MCP unavailable or unauthorized, when MCP is enabled.

The exact error taxonomy is intentionally open for now. Use descriptive, user-facing errors and preserve enough technical detail for debugging without exposing secrets.

## UI requirements

Build the chat and review experience using shadcn components only.

Required states:

- Idle.
- Model selection.
- Job-description entry.
- Submitting.
- Validating.
- Response ready.
- Apply succeeded.
- Apply failed.
- Undo succeeded.
- Error.

Required controls:

- Local Ollama model selector.
- Job-description input.
- Submit button.
- Apply button, enabled only after a valid model response.
- Per-change-group accept/reject controls.
- Accept-all control.
- Undo control.
- Error display.
- Explicit MCP opt-in control, if MCP features are exposed.

The response view must show:

- The accept-all resume preview.
- The change ledger.
- Gaps.
- The affected section/entity for each change.
- A clear distinction between accepted, rejected, and unapplied changes.

## Apply and undo

Apply must:

- Start from the current editor document.
- Apply only accepted change groups.
- Preserve all rejected changes as no-ops.
- Produce one atomic editor-state transition.
- Enable Undo.

Undo must:

- Restore the exact editor document present immediately before Apply.
- Not attempt to reverse CMS saves.
- Remain available for the current AI session.

## Verification

The feature is not complete with mocked unit tests alone.

Manual verification must cover, against a running local Ollama model:

- UI → Ollama request.
- Strict response validation.
- JSON Resume validation.
- Chat response display.
- Change-ledger review.
- Partial Apply.
- Preview update.
- Undo.
- Guest mode without GraphQL calls.
- Failure when Ollama is unavailable.
- Failure when the model emits invalid output.

Run:

```sh
pnpm typecheck && pnpm lint && pnpm test
```

Then perform the manual end-to-end verification above.
