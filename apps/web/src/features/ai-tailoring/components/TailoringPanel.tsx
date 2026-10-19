import { useMemo, useState } from 'react';
import { WandSparkles } from 'lucide-react';
import type { Proposal } from '@resume-studio/ai-contracts';
import { toast } from 'sonner';
import { useEditorStore } from '@/state/editorStore';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  applyTailoringBatch,
  undoTailoringTransaction,
} from '../apply/applyBatch';
import { createTailoringSnapshot, hasMeaningfulResumeContent } from '../analysis/snapshot';
import { runAiAnalysis, testAiConnection } from '../connections/client';
import {
  clearTailoringApiKey,
  setTailoringApiKey,
} from '../credentialStore';
import { useTailoringStore } from '../state/tailoringStore';
import { clearLocalWorkspace, currentScopeFromAuth } from '@/workspace';

function proposalLabel(proposal: Proposal): string {
  const op = proposal.operation;
  if (op.kind === 'appendHighlight') {
    return `Append highlight (${op.parent.kind})`;
  }
  return `Replace text (${op.target.kind})`;
}

function selectedProposalIds(
  proposalDecisions: Record<string, 'pending' | 'selected' | 'rejected'>,
): string[] {
  return Object.entries(proposalDecisions)
    .filter(([, decision]) => decision === 'selected')
    .map(([proposalId]) => proposalId);
}

export function TailoringPanel() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const { isAuthenticated, userId } = useAuth();

  const {
    panelOpen,
    setPanelOpen,
    jobText,
    setJobText,
    status,
    errorMessage,
    setStatus,
    connection,
    setConnection,
    workspaceId,
    jobVersion,
    answerVersion,
    lastAnalysis,
    setAnalysis,
    proposalDecisions,
    proposalEdits,
    setProposalDecision,
    setProposalEdit,
    lastApplied,
    setLastApplied,
  } = useTailoringStore();

  const resume = useEditorStore((s) => s.resume);
  const editorIds = useEditorStore((s) => s.editorIds);
  const revision = useEditorStore((s) => s.revision);
  const documentEpoch = useEditorStore((s) => s.documentEpoch);
  const jsonBuffer = useEditorStore((s) => s.jsonBuffer);
  const workspaceLoadState = useEditorStore((s) => s.workspaceLoadState);

  const commitResumeTransaction = useEditorStore((s) => s.commitResumeTransaction);
  const resetAll = useEditorStore((s) => s.resetAll);

  const canAnalyze =
    workspaceLoadState === 'ready' &&
    hasMeaningfulResumeContent(resume) &&
    jobText.trim().length > 0 &&
    jsonBuffer.isValid &&
    !jsonBuffer.isDirty;

  const selectedCount = useMemo(
    () => selectedProposalIds(proposalDecisions).length,
    [proposalDecisions],
  );

  const runAnalysis = async () => {
    if (!canAnalyze) {
      toast.error('Load a valid resume and job description first.');
      return;
    }

    const snapshot = createTailoringSnapshot(resume, editorIds);

    setStatus('extracting');
    try {
      const analysis = await runAiAnalysis({
        workspaceId,
        documentEpoch,
        baseRevision: revision,
        jobVersion,
        answerVersion,
        jobText,
        snapshot,
        connection,
      });

      const live = useEditorStore.getState();
      const tailoring = useTailoringStore.getState();
      if (
        analysis.workspaceId !== tailoring.workspaceId ||
        analysis.documentEpoch !== live.documentEpoch ||
        analysis.jobVersion !== tailoring.jobVersion
      ) {
        setStatus('outdated', 'Late analysis result ignored because context changed.');
        return;
      }

      setStatus('comparing');
      setAnalysis(analysis);
    } catch (error) {
      setStatus(
        'failed',
        error instanceof Error ? error.message : 'Analysis failed.',
      );
    }
  };

  const onTestConnection = async () => {
    setStatus('extracting');
    const result = await testAiConnection(connection);
    if (!result.ok) {
      setStatus('failed', result.message ?? result.code ?? 'Connection failed');
      return;
    }
    setStatus('idle');
    toast.success('Connection OK');
  };

  const onApplySelected = () => {
    if (!lastAnalysis) {
      toast.error('No analysis to apply.');
      return;
    }

    if (!jsonBuffer.isValid || jsonBuffer.isDirty) {
      toast.error('JSON editor has invalid or unsynced content. Fix it before apply.');
      return;
    }

    const selected = selectedProposalIds(proposalDecisions);
    if (selected.length === 0) {
      toast.error('Select at least one proposal.');
      return;
    }

    const editor = useEditorStore.getState();
    const result = applyTailoringBatch({
      analysis: lastAnalysis,
      resume: editor.resume,
      editorIds: editor.editorIds,
      selectedProposalIds: selected,
      proposalEdits,
      documentEpoch: editor.documentEpoch,
    });

    if (!result.ok) {
      const first = result.conflicts[0];
      toast.error(first?.message ?? 'Apply failed');
      return;
    }

    commitResumeTransaction(result.resume, result.editorIds);
    setLastApplied(result.transaction);
    toast.success('Applied to draft. Save is still explicit and separate.');
  };

  const onUndoLast = () => {
    if (!lastApplied) {
      toast.error('No AI batch to undo.');
      return;
    }

    const editor = useEditorStore.getState();
    if (editor.documentEpoch !== lastApplied.documentEpoch) {
      toast.error('Undo unavailable: document changed since AI apply.');
      return;
    }

    const result = undoTailoringTransaction({
      resume: editor.resume,
      editorIds: editor.editorIds,
      transaction: lastApplied,
    });

    if (!result.ok) {
      toast.error(result.reason);
      return;
    }

    commitResumeTransaction(result.resume, result.editorIds);
    setLastApplied(null);
    toast.success('AI batch undone.');
  };

  const onClearRecovery = async () => {
    const scope = currentScopeFromAuth(isAuthenticated, userId);
    await clearLocalWorkspace(scope);
    clearTailoringApiKey();
    resetAll();
    useTailoringStore.getState().clearAll();
    toast.success('Local recovery cleared.');
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setPanelOpen(true)}
        disabled={workspaceLoadState !== 'ready'}
        title="Tailor resume to a job"
      >
        <WandSparkles data-icon="inline-start" />
        Tailor to job
      </Button>

      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI-assisted tailoring</DialogTitle>
            <DialogDescription>
              Analyze current draft only. Apply updates locally. Save remains explicit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <select
                className="border-input bg-background ring-offset-background h-10 w-full rounded-md border px-3 py-2 text-sm"
                value={connection.providerId}
                onChange={(event) => {
                  const providerId = event.target.value as
                    | 'openai-compatible'
                    | 'ollama'
                    | 'mock';
                  setConnection({ providerId });
                }}
              >
                <option value="mock">Mock (offline)</option>
                <option value="openai-compatible">OpenAI-compatible</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Destination</Label>
              <select
                className="border-input bg-background ring-offset-background h-10 w-full rounded-md border px-3 py-2 text-sm"
                value={connection.destination}
                onChange={(event) => {
                  setConnection({
                    destination: event.target.value as 'local' | 'cloud',
                  });
                }}
              >
                <option value="local">Local</option>
                <option value="cloud">Cloud</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Endpoint</Label>
              <Input
                value={connection.endpoint}
                onChange={(event) => setConnection({ endpoint: event.target.value })}
                placeholder="https://your-openai-compatible-endpoint/v1"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Model</Label>
              <Input
                value={connection.model}
                onChange={(event) => setConnection({ model: event.target.value })}
                placeholder="gpt-4o-mini"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>API key (memory only)</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                  placeholder="Optional for local; required by many cloud providers"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setTailoringApiKey(apiKeyInput);
                    toast.success('API key stored in memory for this session.');
                  }}
                >
                  Set key
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    clearTailoringApiKey();
                    setApiKeyInput('');
                    toast.success('API key cleared.');
                  }}
                >
                  Forget
                </Button>
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Status: {status}
                {errorMessage ? ` — ${errorMessage}` : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onTestConnection}>
                  Test connection
                </Button>
                <Button variant="outline" onClick={onClearRecovery}>
                  Clear local recovery
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Job description</Label>
            <Textarea
              value={jobText}
              onChange={(event) => setJobText(event.target.value)}
              rows={8}
              placeholder="Paste job description"
            />
            <div className="flex items-center gap-2">
              <Button onClick={runAnalysis} disabled={!canAnalyze || status === 'extracting'}>
                Analyze
              </Button>
              {!jsonBuffer.isValid && (
                <p className="text-xs text-destructive">
                  JSON buffer invalid: {jsonBuffer.error ?? 'Fix JSON before analysis.'}
                </p>
              )}
            </div>
          </div>

          {lastAnalysis && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Requirements</h3>
                {lastAnalysis.requirements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No requirements extracted.</p>
                ) : (
                  <ul className="space-y-2">
                    {lastAnalysis.requirements.map((requirement) => (
                      <li key={requirement.id} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">{requirement.text}</p>
                        <p className="text-xs text-muted-foreground">
                          {requirement.status} · {requirement.importance} · “{requirement.jobQuote}”
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Proposals</h3>
                {lastAnalysis.proposals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No safe proposals. Check questions/evidence gaps, then re-run.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {lastAnalysis.proposals.map((proposal) => {
                      const decision = proposalDecisions[proposal.id] ?? 'pending';
                      const edit = proposalEdits[proposal.id] ?? proposal.operation.value;
                      return (
                        <li key={proposal.id} className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{proposalLabel(proposal)}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <Button
                                variant={decision === 'selected' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setProposalDecision(proposal.id, 'selected')}
                              >
                                Select
                              </Button>
                              <Button
                                variant={decision === 'rejected' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setProposalDecision(proposal.id, 'rejected')}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">{proposal.rationale}</p>

                          <Textarea
                            rows={3}
                            value={edit}
                            onChange={(event) =>
                              setProposalEdit(proposal.id, event.target.value)
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={onUndoLast} disabled={!lastApplied}>
                  Undo last AI batch
                </Button>
                <Button onClick={onApplySelected} disabled={selectedCount === 0}>
                  Apply selected ({selectedCount})
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
