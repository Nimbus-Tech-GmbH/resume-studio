import { useCallback, useMemo, useRef, useState } from 'react';
import {
  checkAtsWithMcp,
  groupChanges,
  isConnectionConfigured,
  listConnectionModels,
  validateResumeWithMcp,
  type ChangeGroup,
  type ProviderId,
  type TailoringMessage,
  type TailoringRequestIdentity,
} from '@resume-studio/ai';
import { toast } from 'sonner';
import { RotateCcw, Send, Settings2, Sparkles, X } from 'lucide-react';
import { useEditorStore } from '@/state/editorStore';
import { PanelHeader } from '@/components/PanelHeader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Label } from '@/components/ui/label';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { applyTailoringBatch, undoTailoringTransaction } from '../apply/applyBatch';
import { createTailoringSnapshot, hasMeaningfulResumeContent } from '../analysis/snapshot';
import { runTailoringRequest, testAiConnection } from '../connections/client';
import {
  PROVIDER_PRESETS,
  connectionForRequest,
  providerPreset,
} from '../connections/providers';
import { useTailoringStore } from '../state/tailoringStore';
import {
  abortActiveRequest,
  finishRequestController,
  startRequestController,
} from '../requestController';
import { clearLocalWorkspace, currentScopeFromAuth } from '@/workspace';
import { useAuth } from '@/auth/AuthContext';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function previewValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  const text = JSON.stringify(value);
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

function ChatMessageRow({ message }: { message: TailoringMessage }) {
  const isUser = message.role === 'user';
  const statusLabel =
    message.status === 'streaming'
      ? 'Generating'
      : message.status === 'failed'
        ? 'Failed'
        : message.status === 'interrupted'
          ? 'Cancelled'
          : null;

  return (
    <Message align={isUser ? 'end' : 'start'}>
      <MessageContent className="gap-1">
        <Bubble variant={isUser ? 'default' : 'muted'} align={isUser ? 'end' : 'start'}>
          <BubbleContent>
            {message.content ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Spinner className="size-3" />
                Thinking…
              </span>
            )}
          </BubbleContent>
        </Bubble>
        {statusLabel ? <MessageFooter className="px-0.5">{statusLabel}</MessageFooter> : null}
      </MessageContent>
    </Message>
  );
}

function ChangeGroupCard({ group }: { group: ChangeGroup }) {
  const decision = useTailoringStore((state) => state.changeDecisions[group.id] ?? 'pending');
  const setChangeDecision = useTailoringStore((state) => state.setChangeDecision);
  const applied = decision === 'applied';

  return (
    <li className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {group.label} <span className="text-muted-foreground">({group.id})</span>
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant={decision === 'selected' ? 'default' : 'outline'}
            size="sm"
            disabled={applied}
            onClick={() => setChangeDecision(group.id, 'selected')}
          >
            Select
          </Button>
          <Button
            variant={decision === 'rejected' ? 'default' : 'outline'}
            size="sm"
            disabled={applied}
            onClick={() => setChangeDecision(group.id, 'rejected')}
          >
            Reject
          </Button>
          {applied ? <span className="text-xs text-muted-foreground">Applied</span> : null}
        </div>
      </div>

      <ul className="space-y-2">
        {group.changes.map((change) => (
          <li key={change.id} className="space-y-1 rounded-md bg-muted/40 p-2 text-xs">
            <p className="font-mono text-[0.7rem] text-muted-foreground">
              {change.type} · {change.op} {change.path}
            </p>
            <p className="text-muted-foreground">{change.summary}</p>
            <p>
              <span className="text-muted-foreground">Before: </span>
              {previewValue(change.before)}
            </p>
            <p>
              <span className="text-muted-foreground">After: </span>
              {previewValue(change.after)}
            </p>
            <p className="text-muted-foreground">{change.summary}</p>
            {change.evidence.length > 0 ? (
              <p className="font-mono text-[0.7rem] text-muted-foreground">
                Evidence: {change.evidence.join(', ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

export function TailoringPanel() {
  const [composer, setComposer] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpToken, setMcpToken] = useState('');
  const [mcpBusy, setMcpBusy] = useState(false);
  const [mcpResult, setMcpResult] = useState<string | null>(null);
  const generationLock = useRef(false);
  const { isAuthenticated, userId } = useAuth();

  const {
    jobText,
    setJobText,
    status,
    errorMessage,
    errorCode,
    connection,
    setConnection,
    replaceConnection,
    workspaceId,
    jobVersion,
    lastAnalysis,
    setAnalysis,
    changeDecisions,
    setAllChangeDecisions,
    lastApplied,
    setLastApplied,
    messages,
    activeRequestId,
    appendUserMessage,
    beginRequest,
    updateStreamingText,
    completeAssistantMessage,
    failRequest,
    cancelRequest,
    setStatus,
  } = useTailoringStore();

  const resume = useEditorStore((s) => s.resume);
  const jsonBuffer = useEditorStore((s) => s.jsonBuffer);
  const workspaceLoadState = useEditorStore((s) => s.workspaceLoadState);
  const commitResumeTransaction = useEditorStore((s) => s.commitResumeTransaction);
  const resetAll = useEditorStore((s) => s.resetAll);

  const hasJobDescription = jobText.trim().length > 0;
  const connectionReady = isConnectionConfigured(connection);
  const canGenerate =
    workspaceLoadState === 'ready' &&
    hasMeaningfulResumeContent(resume) &&
    hasJobDescription &&
    jsonBuffer.isValid &&
    !jsonBuffer.isDirty &&
    connectionReady &&
    !activeRequestId;

  const composerHint = !hasJobDescription
    ? 'Paste a job description above to start.'
    : !hasMeaningfulResumeContent(resume)
      ? 'Add resume content before generating.'
      : !connectionReady
        ? 'Open settings to configure a model provider.'
        : !jsonBuffer.isValid
          ? 'Fix the JSON buffer before generating.'
          : jsonBuffer.isDirty
            ? 'Apply or discard JSON edits before generating.'
            : 'Enter to send · Shift+Enter for a new line';

  const groups = useMemo(
    () => (lastAnalysis ? groupChanges(lastAnalysis.response.changes) : []),
    [lastAnalysis],
  );
  const selectedGroupIds = useMemo(
    () => groups.filter((group) => changeDecisions[group.id] === 'selected').map((group) => group.id),
    [changeDecisions, groups],
  );
  const gapCount = lastAnalysis?.response.gaps.length ?? 0;

  const captureIdentity = (
    snapshotHash: string,
    requestId: string,
  ): TailoringRequestIdentity => {
    const live = useEditorStore.getState();
    const tailoring = useTailoringStore.getState();
    return {
      requestId,
      workspaceId: tailoring.workspaceId,
      documentEpoch: live.documentEpoch,
      baseRevision: live.revision,
      snapshotHash,
      jobVersion: tailoring.jobVersion,
      connectionVersion: tailoring.connectionVersion,
      conversationVersion: tailoring.conversationVersion,
    };
  };

  const isStale = (identity: TailoringRequestIdentity): boolean => {
    const live = useEditorStore.getState();
    const tailoring = useTailoringStore.getState();
    if (tailoring.activeRequestId !== identity.requestId) return true;
    if (tailoring.workspaceId !== identity.workspaceId) return true;
    if (live.documentEpoch !== identity.documentEpoch) return true;
    if (live.revision !== identity.baseRevision) return true;
    if (tailoring.jobVersion !== identity.jobVersion) return true;
    if (tailoring.connectionVersion !== identity.connectionVersion) return true;
    if (tailoring.conversationVersion !== identity.conversationVersion) return true;
    const snapshot = createTailoringSnapshot(live.resume);
    if (snapshot.snapshotHash !== identity.snapshotHash) return true;
    return false;
  };

  const runGeneration = async (userText: string) => {
    if (!canGenerate || generationLock.current) {
      toast.error('Load a valid resume, configure a model provider, and paste a job description.');
      return;
    }

    generationLock.current = true;
    const requestId = randomId();
    const snapshot = createTailoringSnapshot(resume);
    const identityBefore = captureIdentity(snapshot.snapshotHash, requestId);
    appendUserMessage(userText);
    const identity: TailoringRequestIdentity = {
      ...identityBefore,
      conversationVersion: useTailoringStore.getState().conversationVersion,
    };
    const signal = startRequestController(requestId);
    beginRequest(requestId, '');

    let sawTerminalEvent = false;
    try {
      await runTailoringRequest({
        identity,
        connection,
        sourceResume: useEditorStore.getState().resume as unknown as Record<string, unknown>,
        resume: snapshot.resume,
        withheldPaths: snapshot.withheldPaths,
        jobDescription: jobText,
        userConstraints: userText,
        abortSignal: signal,
        onEvent: (event) => {
          if (event.requestId !== requestId) return;
          if (event.type === 'assistant-text') {
            updateStreamingText(requestId, event.text);
            return;
          }
          if (event.type === 'analysis') {
            if (isStale(identity)) {
              sawTerminalEvent = true;
              failRequest(
                requestId,
                'Late result rejected because context changed.',
                'STALE_CONTEXT',
              );
              toast.error('Result rejected: resume/job/context changed during generation.');
              return;
            }
            setStatus('validating-output');
            completeAssistantMessage(
              requestId,
              useTailoringStore.getState().streamingAssistantText ||
                'Tailoring ready for review.',
            );
            setAnalysis(event.analysis);
            sawTerminalEvent = true;
            return;
          }
          if (event.type === 'error') {
            sawTerminalEvent = true;
            if (useTailoringStore.getState().activeRequestId !== requestId) return;
            failRequest(requestId, event.message, event.code);
            toast.error(event.message || event.code);
            return;
          }
          if (event.type === 'complete') {
            sawTerminalEvent = true;
            finishRequestController(requestId);
          }
        },
      });

      if (!sawTerminalEvent && useTailoringStore.getState().activeRequestId === requestId) {
        failRequest(
          requestId,
          'Stream ended without a result. Check the provider logs.',
          'CONNECTION_FAILED',
        );
        toast.error('Stream ended without a result.');
      }
    } catch (error) {
      if (useTailoringStore.getState().activeRequestId === requestId) {
        const message = error instanceof Error ? error.message : 'Unexpected client failure.';
        failRequest(requestId, message, 'CONNECTION_FAILED');
        toast.error(message);
      }
    } finally {
      finishRequestController(requestId);
      generationLock.current = false;
    }
  };

  const onSend = async () => {
    const text = composer.trim();
    setComposer('');
    await runGeneration(text);
  };

  const onCancel = () => {
    if (!activeRequestId) return;
    abortActiveRequest();
    cancelRequest(activeRequestId);
  };

  const refreshModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const models = await listConnectionModels(connectionForRequest(connection));
      setInstalledModels(models);
      if (models.length === 0) {
        setModelsError('The provider reported no installed models.');
      } else if (!models.includes(connection.model)) {
        setConnection({ model: models[0]! });
      }
    } catch (error) {
      setModelsError(
        error instanceof Error ? error.message : 'Could not list provider models.',
      );
    } finally {
      setModelsLoading(false);
    }
  }, [connection, setConnection]);

  const openSettings = () => {
    setSettingsOpen(true);
    void refreshModels();
  };

  const onTestConnection = async () => {
    setStatus('validating');
    const result = await testAiConnection(connection);
    if (!result.ok) {
      setStatus('failed', result.message ?? result.code ?? 'Connection failed', 'CONNECTION_FAILED');
      return;
    }
    setStatus('idle');
    toast.success(`${PROVIDER_PRESETS[connection.providerId].label} connection OK.`);
  };

  const applyGroups = (groupIds: string[]) => {
    if (!lastAnalysis) {
      toast.error('No analysis to apply.');
      return;
    }
    if (groupIds.length === 0) {
      toast.error('Select at least one change group.');
      return;
    }

    const editor = useEditorStore.getState();
    const snapshot = createTailoringSnapshot(editor.resume);
    const result = applyTailoringBatch({
      analysis: lastAnalysis,
      resume: editor.resume,
      editorIds: editor.editorIds,
      selectedGroupIds: groupIds,
      documentEpoch: editor.documentEpoch,
      workspaceId,
      baseRevision: editor.revision,
      jobVersion: useTailoringStore.getState().jobVersion,
      snapshotHash: snapshot.snapshotHash,
      jsonBufferValid: editor.jsonBuffer.isValid,
      jsonBufferDirty: editor.jsonBuffer.isDirty,
    });

    if (!result.ok) {
      const first = result.conflicts[0];
      toast.error(first?.message ?? 'Apply failed');
      return;
    }

    commitResumeTransaction(result.resume, result.editorIds);
    setLastApplied(result.transaction);
    for (const groupId of groupIds) {
      useTailoringStore.getState().setChangeDecision(groupId, 'applied');
    }
    toast.success('Applied to draft. Save remains explicit and separate.');
  };

  const onApplySelected = () => applyGroups(selectedGroupIds);
  const onAcceptAll = () => applyGroups(groups.map((group) => group.id));

  const onUndoLast = () => {
    if (!lastApplied) {
      toast.error('No AI batch to undo.');
      return;
    }
    const editor = useEditorStore.getState();
    const result = undoTailoringTransaction({
      resume: editor.resume,
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

  const onRunMcpValidation = async (kind: 'validate' | 'ats') => {
    if (!mcpEnabled) {
      toast.error('Enable JSON Resume MCP first.');
      return;
    }
    if (!lastAnalysis) {
      toast.error('Generate a tailoring result first.');
      return;
    }
    setMcpBusy(true);
    setMcpResult(null);
    try {
      const result =
        kind === 'validate'
          ? await validateResumeWithMcp(
              lastAnalysis.response.resume,
              mcpToken.trim() || undefined,
            )
          : await checkAtsWithMcp(
              lastAnalysis.response.resume,
              mcpToken.trim() || undefined,
            );
      setMcpResult(JSON.stringify(result.content, null, 2));
      toast.success(
        kind === 'validate' ? 'MCP validation complete.' : 'MCP ATS check complete.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MCP request failed.';
      setMcpResult(message);
      toast.error(message);
    } finally {
      setMcpBusy(false);
    }
  };

  const onClearRecovery = async () => {
    abortActiveRequest();
    const scope = currentScopeFromAuth(isAuthenticated, userId);
    await clearLocalWorkspace(scope);
    resetAll();
    useTailoringStore.getState().clearAll();
    toast.success('Local recovery cleared.');
  };

  const hasPendingChanges = groups.some(
    (group) => (changeDecisions[group.id] ?? 'pending') !== 'applied',
  );
  const headerStatus =
    status === 'failed' || status === 'interrupted' || status === 'cancelled'
      ? 'error'
      : status === 'streaming' || status === 'validating' || status === 'validating-output'
        ? 'live'
        : status === 'outdated' || hasPendingChanges
          ? 'warning'
          : undefined;
  const headerStatusLabel =
    status === 'failed'
      ? 'Failed'
      : status === 'interrupted' || status === 'cancelled'
        ? 'Cancelled'
        : status === 'streaming'
          ? 'Generating'
          : status === 'validating-output'
            ? 'Validating'
            : status === 'validating'
              ? 'Testing'
              : status === 'outdated'
                ? 'Outdated'
                : hasPendingChanges
                  ? 'Review'
                  : undefined;

  if (workspaceLoadState !== 'ready') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <PanelHeader title="AI Tailoring" />
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          Open or create a resume to use AI tailoring.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title="AI Tailoring"
        status={headerStatus}
        statusLabel={headerStatusLabel}
        action={
          <Button
            variant="outline"
            size="xs"
            className="relative cursor-pointer"
            onClick={openSettings}
            title="Tailoring settings"
            aria-label="Open tailoring settings"
          >
            <Settings2 />
            {lastAnalysis && groups.length > 0 ? (
              <span
                className="bg-primary absolute -top-0.5 -right-0.5 size-1.5 rounded-full"
                aria-hidden="true"
              />
            ) : null}
          </Button>
        }
      />

      <ResizablePanelGroup
        orientation="vertical"
        autoSave="tailoring-job-chat-layout"
        className="min-h-0 flex-1"
      >
        <ResizablePanel defaultSize="34%" minSize="16%">
          <div className="bg-muted/20 flex h-full min-h-0 flex-col gap-2 p-3">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <Label htmlFor="tailoring-job-description">Job description</Label>
              {jobVersion > 0 ? (
                <span className="text-[0.625rem] text-muted-foreground">Job v{jobVersion}</span>
              ) : null}
            </div>
            <Textarea
              id="tailoring-job-description"
              value={jobText}
              onChange={(event) => {
                if (activeRequestId) abortActiveRequest();
                setJobText(event.target.value);
              }}
              className="min-h-0 flex-1 overflow-y-auto bg-background"
              placeholder="Paste the job description you are targeting"
            />
            <p className="shrink-0 text-[0.625rem] text-muted-foreground">
              {hasJobDescription
                ? 'Editing the job description starts a fresh tailoring context.'
                : 'Paste a role above, then ask how to tailor your resume.'}
            </p>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="66%" minSize="28%">
          <div className="flex h-full min-h-0 flex-col">
            <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
              <MessageScroller className="min-h-0 flex-1">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="gap-4 p-3" aria-busy={status === 'streaming'}>
                    {messages.length === 0 ? (
                      <MessageScrollerItem className="flex min-h-full items-center justify-center">
                        <Empty className="border-0">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Sparkles />
                            </EmptyMedia>
                            <EmptyTitle>Tailor this resume to the role</EmptyTitle>
                            <EmptyDescription>
                              The model returns an accept-all resume preview plus grouped changes.
                              Nothing changes until you apply a group.
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canGenerate}
                              onClick={() =>
                                void runGeneration('Tailor my resume to this job description.')
                              }
                            >
                              Analyze my resume
                            </Button>
                          </EmptyContent>
                        </Empty>
                      </MessageScrollerItem>
                    ) : (
                      messages.map((message) => (
                        <MessageScrollerItem
                          key={message.id}
                          messageId={message.id}
                          scrollAnchor={message.role === 'user'}
                        >
                          <ChatMessageRow message={message} />
                        </MessageScrollerItem>
                      ))
                    )}

                    {lastAnalysis ? (
                      <MessageScrollerItem messageId="tailoring-analysis">
                        <Marker>
                          <MarkerIcon>
                            <Sparkles />
                          </MarkerIcon>
                          <MarkerContent>
                            {groups.length === 0
                              ? gapCount > 0
                                ? `No safe edits. ${gapCount} gap${gapCount === 1 ? '' : 's'} found.`
                                : 'Analysis ready. No changes needed.'
                              : `${groups.length} change group${
                                  groups.length === 1 ? '' : 's'
                                }, ${gapCount} gap${gapCount === 1 ? '' : 's'} ready for review.`}
                          </MarkerContent>
                          <Button
                            size="xs"
                            variant="outline"
                            className="ml-auto"
                            onClick={openSettings}
                          >
                            Review
                          </Button>
                        </Marker>
                      </MessageScrollerItem>
                    ) : null}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>

            <div className="shrink-0 space-y-2 border-t p-3">
              <InputGroup className="h-auto min-h-16 bg-background">
                <InputGroupTextarea
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      if (canGenerate) void onSend();
                    }
                  }}
                  rows={2}
                  className="min-h-16 py-2"
                  placeholder="Optional constraints, e.g. keep it one page…"
                  aria-label="Constraints for this tailoring request"
                />
                <InputGroupAddon align="block-end" className="border-t">
                  <p className="truncate text-[0.625rem] text-muted-foreground">{composerHint}</p>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {messages.length > 0 && !activeRequestId ? (
                      <InputGroupButton
                        variant="outline"
                        size="icon-xs"
                        disabled={!canGenerate}
                        onClick={() => void runGeneration('')}
                        title="Retry"
                        aria-label="Retry"
                      >
                        <RotateCcw />
                      </InputGroupButton>
                    ) : null}
                    {activeRequestId ? (
                      <InputGroupButton
                        variant="outline"
                        size="icon-xs"
                        onClick={onCancel}
                        title="Cancel"
                        aria-label="Cancel"
                      >
                        <X />
                      </InputGroupButton>
                    ) : null}
                    <InputGroupButton
                      variant="default"
                      size="icon-xs"
                      onClick={() => void onSend()}
                      disabled={!canGenerate}
                      title={activeRequestId ? 'Generating…' : 'Send'}
                      aria-label={activeRequestId ? 'Generating…' : 'Send'}
                    >
                      <Send />
                    </InputGroupButton>
                  </div>
                </InputGroupAddon>
              </InputGroup>
              {errorMessage ? (
                <p className="text-xs text-destructive">
                  {errorCode ? `[${errorCode}] ` : ''}
                  {errorMessage}
                </p>
              ) : null}
              {!jsonBuffer.isValid ? (
                <p className="text-xs text-destructive">
                  JSON buffer invalid: {jsonBuffer.error ?? 'Fix JSON before generation.'}
                </p>
              ) : null}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tailoring settings</DialogTitle>
            <DialogDescription>
              Ollama runs locally; OpenCode inference is called over HTTPS with an API key. Contact
              fields are withheld from the model and restored from your editor copy. Nothing is
              written until you apply a change group.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-6 overflow-y-auto px-1 pb-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="tailoring-provider">Provider</Label>
                <Select
                  value={connection.providerId}
                  onValueChange={(value) => {
                    const providerId = value as ProviderId;
                    if (providerId === connection.providerId) return;
                    replaceConnection(providerPreset(providerId));
                    setInstalledModels([]);
                    setModelsError(null);
                  }}
                >
                  <SelectTrigger id="tailoring-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROVIDER_PRESETS) as ProviderId[]).map((providerId) => (
                      <SelectItem key={providerId} value={providerId}>
                        {PROVIDER_PRESETS[providerId].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tailoring-endpoint">Endpoint</Label>
                <Input
                  id="tailoring-endpoint"
                  value={connection.endpoint}
                  onChange={(event) => setConnection({ endpoint: event.target.value })}
                  placeholder={
                    connection.providerId === 'ollama'
                      ? 'http://127.0.0.1:11434/v1'
                      : 'https://opencode.ai/inference/openai/v1'
                  }
                />
              </div>

              {connection.providerId === 'opencode' ? (
                <div className="space-y-2">
                  <Label htmlFor="tailoring-opencode-api-key">API key</Label>
                  <Input
                    id="tailoring-opencode-api-key"
                    type="password"
                    autoComplete="off"
                    value={connection.apiKey ?? ''}
                    onChange={(event) => setConnection({ apiKey: event.target.value })}
                    placeholder="oc_sk_…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent as an Authorization: Bearer token. Held in memory only and never written
                    to recovery.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="tailoring-model">Model</Label>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void refreshModels()}
                    disabled={modelsLoading}
                  >
                    {modelsLoading ? 'Loading…' : 'Refresh models'}
                  </Button>
                </div>
                {installedModels.length > 0 ? (
                  <Select
                    value={connection.model}
                    onValueChange={(model) => setConnection({ model })}
                  >
                    <SelectTrigger id="tailoring-model" className="w-full">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...new Set([connection.model, ...installedModels])]
                        .filter(Boolean)
                        .map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="tailoring-model"
                    value={connection.model}
                    onChange={(event) => setConnection({ model: event.target.value })}
                    placeholder={connection.providerId === 'ollama' ? 'llama3.1:latest' : 'provider/model'}
                  />
                )}
                {modelsError ? (
                  <p className="text-xs text-destructive">{modelsError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {connection.providerId === 'ollama'
                      ? 'Models are read from the local Ollama instance.'
                      : 'Models are read from the OpenCode inference catalog.'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tailoring-context-tokens">Context tokens</Label>
                  <Input
                    id="tailoring-context-tokens"
                    type="number"
                    value={connection.contextTokens}
                    onChange={(event) =>
                      setConnection({ contextTokens: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tailoring-max-output-tokens">Max output tokens</Label>
                  <Input
                    id="tailoring-max-output-tokens"
                    type="number"
                    value={connection.maxOutputTokens}
                    onChange={(event) =>
                      setConnection({ maxOutputTokens: Number(event.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                App origin: {typeof window !== 'undefined' ? window.location.origin : ''}.{' '}
                {connection.providerId === 'ollama'
                  ? 'Permit this exact origin in OLLAMA_ORIGINS (not *).'
                  : 'OpenCode inference is called directly from this browser.'}
              </p>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Status: {status}
                  {errorCode ? ` [${errorCode}]` : ''}
                  {errorMessage ? ` — ${errorMessage}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={onTestConnection}>
                    Test connection
                  </Button>
                  <Button variant="outline" size="sm" onClick={onClearRecovery}>
                    Clear local recovery
                  </Button>
                </div>
              </div>
            </div>

            {lastAnalysis ? (
              <>
                <Separator />

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Accept-all resume preview</h3>
                  <p className="text-xs text-muted-foreground">
                    This is the model result, not the editor document. Contact fields are restored
                    from your editor copy. Nothing changes until you apply a group.
                  </p>
                  <ScrollArea className="h-64 rounded-md border bg-muted/30">
                    <pre className="p-3 text-[0.7rem] whitespace-pre-wrap">
                      {JSON.stringify(lastAnalysis.response.resume, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Change groups</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAllChangeDecisions('selected')}
                      >
                        Select all
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAllChangeDecisions('rejected')}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No safe edits. Review the gaps below.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {groups.map((group) => (
                        <ChangeGroupCard key={group.id} group={group} />
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Gaps</h3>
                  {lastAnalysis.response.gaps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No gaps reported.</p>
                  ) : (
                    <ul className="space-y-2">
                      {lastAnalysis.response.gaps.map((gap) => (
                        <li key={gap.id} className="rounded-md border p-2 text-sm">
                          <p className="font-medium">{gap.requirement}</p>
                          <p className="text-xs text-muted-foreground">{gap.explanation}</p>
                          <p className="text-xs text-muted-foreground">{gap.reason}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">JSON Resume MCP (optional)</h3>
                  <p className="text-xs text-muted-foreground">
                    Enabling this sends the tailored resume to jsonresume.org for read-only
                    validation or ATS checks. Tailoring works without MCP. No MCP write, save,
                    export, or account tool is ever called.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={mcpEnabled ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={mcpEnabled}
                      onClick={() => {
                        setMcpEnabled((current) => !current);
                        setMcpResult(null);
                      }}
                    >
                      {mcpEnabled ? 'MCP opt-in enabled' : 'Opt in to MCP'}
                    </Button>
                    {mcpEnabled ? (
                      <Input
                        type="password"
                        className="max-w-xs"
                        value={mcpToken}
                        onChange={(event) => setMcpToken(event.target.value)}
                        placeholder="jr_… API key (kept in memory only)"
                        aria-label="jsonresume.org API key"
                      />
                    ) : null}
                  </div>
                  {mcpEnabled ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mcpBusy}
                        onClick={() => void onRunMcpValidation('validate')}
                      >
                        {mcpBusy ? 'Running…' : 'Validate with MCP'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mcpBusy}
                        onClick={() => void onRunMcpValidation('ats')}
                      >
                        {mcpBusy ? 'Running…' : 'Check ATS with MCP'}
                      </Button>
                    </div>
                  ) : null}
                  {mcpResult ? (
                    <ScrollArea className="h-40 rounded-md border bg-muted/30">
                      <pre className="p-3 text-[0.7rem] whitespace-pre-wrap">{mcpResult}</pre>
                    </ScrollArea>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
                  <Button variant="outline" size="sm" onClick={onUndoLast} disabled={!lastApplied}>
                    Undo last AI batch
                  </Button>
                  <Button variant="outline" size="sm" onClick={onApplySelected} disabled={selectedGroupIds.length === 0}>
                    Apply selected ({selectedGroupIds.length})
                  </Button>
                  <Button size="sm" onClick={onAcceptAll} disabled={groups.length === 0}>
                    Accept all
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No analysis yet. Chat about the role to generate changes.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
