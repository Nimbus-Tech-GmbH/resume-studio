import type {
  PresentationInputV1,
  PresentationStatus,
  PresentationStatusEvent,
} from '@resume-studio/studio-contracts';

export const DOCUMENT_DEBOUNCE_MS = 300;

export type PresentationTransport = (
  input: PresentationInputV1,
  signal: AbortSignal,
) => Promise<string>;

export interface PresentationSnapshot {
  readonly status: PresentationStatus;
  readonly html: string | null;
  readonly error: string | null;
  readonly input: PresentationInputV1;
}

export interface PresentationControllerOptions {
  readonly transport: PresentationTransport;
  readonly onChange: (snapshot: PresentationSnapshot) => void;
  readonly onStatusChange?: (event: PresentationStatusEvent) => void;
  readonly debounceMs?: number;
}

export interface PresentationController {
  update(input: PresentationInputV1): void;
  retry(): void;
  getSnapshot(): PresentationSnapshot;
  dispose(): void;
}

export function createInitialPresentationSnapshot(
  input: PresentationInputV1,
): PresentationSnapshot {
  return { status: 'idle', html: null, error: null, input };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'Presentation render failed';
}

function isCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function createPresentationController(
  initialInput: PresentationInputV1,
  options: PresentationControllerOptions,
): PresentationController {
  const debounceMs = options.debounceMs ?? DOCUMENT_DEBOUNCE_MS;
  let snapshot = createInitialPresentationSnapshot(initialInput);
  let latestInput: PresentationInputV1 | null = null;
  let htmlDocumentKey: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeController: AbortController | null = null;
  let generation = 0;
  let disposed = false;

  const publish = (
    status: PresentationStatus,
    input: PresentationInputV1,
    error: string | null,
    html: string | null = snapshot.html,
  ): void => {
    snapshot = { status, html, error, input };
    options.onChange(snapshot);
    options.onStatusChange?.({
      documentKey: input.document.key,
      revision: input.document.revision,
      status,
    });
  };

  const clearPending = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    activeController?.abort();
    activeController = null;
  };

  const invalidate = (): number => {
    generation += 1;
    clearPending();
    return generation;
  };

  const start = (input: PresentationInputV1, requestGeneration: number): void => {
    if (disposed || requestGeneration !== generation) return;
    const controller = new AbortController();
    activeController = controller;

    let request: Promise<string>;
    try {
      request = options.transport(input, controller.signal);
    } catch (error) {
      request = Promise.reject(error);
    }

    void request.then(
      (html) => {
        if (disposed || requestGeneration !== generation) return;
        activeController = null;
        htmlDocumentKey = input.document.key;
        publish('ready', input, null, html);
      },
      (error: unknown) => {
        if (disposed || requestGeneration !== generation || isCancellation(error)) {
          return;
        }
        activeController = null;
        publish('error', input, errorMessage(error));
      },
    );
  };

  const schedule = (input: PresentationInputV1, requestGeneration: number, delay: number): void => {
    timer = setTimeout(() => {
      timer = null;
      start(input, requestGeneration);
    }, delay);
  };

  const update = (input: PresentationInputV1): void => {
    if (disposed || latestInput === input) return;

    const previousInput = latestInput;
    const sameDocument =
      previousInput !== null && previousInput.document.key === input.document.key;
    const themeChanged = sameDocument && previousInput.themeId !== input.themeId;
    latestInput = input;
    const requestGeneration = invalidate();
    const retainedHtml = htmlDocumentKey === input.document.key ? snapshot.html : null;

    publish('rendering', input, null, retainedHtml);
    schedule(input, requestGeneration, themeChanged ? 0 : debounceMs);
  };

  const retry = (): void => {
    if (disposed || latestInput === null) return;
    const requestGeneration = invalidate();
    const retainedHtml = htmlDocumentKey === latestInput.document.key ? snapshot.html : null;
    publish('rendering', latestInput, null, retainedHtml);
    start(latestInput, requestGeneration);
  };

  update(initialInput);

  return {
    update,
    retry,
    getSnapshot: () => snapshot,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      invalidate();
    },
  };
}
