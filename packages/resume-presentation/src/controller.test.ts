import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PresentationInputV1, PresentationStatusEvent } from '@resume-studio/studio-contracts';
import {
  createPresentationController,
  DOCUMENT_DEBOUNCE_MS,
  type PresentationController,
  type PresentationSnapshot,
  type PresentationTransport,
} from './controller';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

interface RenderCall {
  readonly input: PresentationInputV1;
  readonly signal: AbortSignal;
  readonly deferred: Deferred<string>;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((error: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve: (value) => resolvePromise?.(value),
    reject: (error) => rejectPromise?.(error),
  };
}

function input({
  key = 'document-a',
  revision = 1,
  themeId = 'modern',
  name = `Revision ${revision}`,
}: {
  key?: string;
  revision?: number;
  themeId?: string;
  name?: string;
} = {}): PresentationInputV1 {
  return {
    contractVersion: 1,
    document: {
      key,
      revision,
      resume: { basics: { name } },
    },
    themeId,
  };
}

function abortError(): Error {
  const error = new Error('cancelled');
  error.name = 'AbortError';
  return error;
}

function setup(
  initial = input(),
  debounceMs = DOCUMENT_DEBOUNCE_MS,
): {
  controller: PresentationController;
  calls: RenderCall[];
  snapshots: PresentationSnapshot[];
  events: PresentationStatusEvent[];
} {
  const calls: RenderCall[] = [];
  const snapshots: PresentationSnapshot[] = [];
  const events: PresentationStatusEvent[] = [];
  const transport: PresentationTransport = (requestInput, signal) => {
    const request = deferred<string>();
    calls.push({ input: requestInput, signal, deferred: request });
    return request.promise;
  };
  const controller = createPresentationController(initial, {
    transport,
    debounceMs,
    onChange: (snapshot) => snapshots.push(snapshot),
    onStatusChange: (event) => events.push(event),
  });
  return { controller, calls, snapshots, events };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('presentation lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not request before document debounce expires', () => {
    const { controller, calls } = setup();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'rendering',
      html: null,
    });
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS - 1);
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(1);
  });

  it('coalesces a revision burst into one latest request', () => {
    const { controller, calls } = setup();
    vi.advanceTimersByTime(100);
    controller.update(input({ revision: 2 }));
    vi.advanceTimersByTime(100);
    controller.update(input({ revision: 3 }));
    vi.advanceTimersByTime(299);
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input.document.revision).toBe(3);
  });

  it('uses one debounce rather than debouncing transport twice', () => {
    const { calls } = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    expect(calls).toHaveLength(1);
  });

  it('renders theme changes immediately with latest pending revision', () => {
    const { controller, calls } = setup();
    vi.advanceTimersByTime(100);
    controller.update(input({ revision: 2 }));
    vi.advanceTimersByTime(100);
    controller.update(input({ revision: 2, themeId: 'mono' }));
    vi.advanceTimersByTime(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toMatchObject({
      themeId: 'mono',
      document: { revision: 2 },
    });
    vi.runAllTimers();
    expect(calls).toHaveLength(1);
  });

  it('aborts in-flight work and immediately starts a superseding theme', () => {
    const { controller, calls } = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    controller.update(input({ themeId: 'mono' }));
    expect(calls[0]?.signal.aborted).toBe(true);
    vi.advanceTimersByTime(0);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.input.themeId).toBe('mono');
  });

  it('ignores out-of-order success after newer success', async () => {
    const { controller, calls } = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    controller.update(input({ revision: 2 }));
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    calls[1]?.deferred.resolve('<p>new</p>');
    await settle();
    calls[0]?.deferred.resolve('<p>old</p>');
    await settle();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      html: '<p>new</p>',
      input: { document: { revision: 2 } },
    });
  });

  it('ignores stale errors from superseded generations', async () => {
    const { controller, calls, events } = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    controller.update(input({ revision: 2 }));
    calls[0]?.deferred.reject(new Error('stale failure'));
    await settle();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'rendering',
      error: null,
      input: { document: { revision: 2 } },
    });
    expect(events.some((event) => event.status === 'error')).toBe(false);
  });

  it('prevents stale completion from altering current rendering state', async () => {
    const { controller, calls, snapshots } = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    controller.update(input({ revision: 2 }));
    const snapshotCount = snapshots.length;
    calls[0]?.deferred.resolve('<p>stale</p>');
    await settle();
    expect(snapshots).toHaveLength(snapshotCount);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'rendering',
      html: null,
      input: { document: { revision: 2 } },
    });
  });

  it('disposes pending timers and active requests', async () => {
    const pending = setup();
    pending.controller.dispose();
    vi.runAllTimers();
    expect(pending.calls).toHaveLength(0);

    const active = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    const snapshotCount = active.snapshots.length;
    active.controller.dispose();
    expect(active.calls[0]?.signal.aborted).toBe(true);
    active.calls[0]?.deferred.resolve('<p>late</p>');
    await settle();
    expect(active.snapshots).toHaveLength(snapshotCount);
  });

  it('invalidates successful HTML immediately for a different key', async () => {
    const { controller, calls } = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    calls[0]?.deferred.resolve('<p>document a</p>');
    await settle();
    controller.update(input({ key: 'document-b', revision: 1 }));
    expect(controller.getSnapshot()).toMatchObject({
      status: 'rendering',
      html: null,
      input: { document: { key: 'document-b' } },
    });
  });

  it('retries immediately with latest input', async () => {
    const { controller, calls } = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    calls[0]?.deferred.reject(new Error('offline'));
    await settle();
    controller.update(input({ revision: 2 }));
    controller.retry();
    expect(calls).toHaveLength(2);
    expect(calls[1]?.input.document.revision).toBe(2);
  });

  it('does not turn cancellation into an error', async () => {
    const { controller, calls, events } = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    calls[0]?.deferred.reject(abortError());
    await settle();
    expect(controller.getSnapshot().status).toBe('rendering');
    expect(events.some((event) => event.status === 'error')).toBe(false);
  });

  it('retains same-key HTML across revision rendering and recoverable error', async () => {
    const { controller, calls } = setup();
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    calls[0]?.deferred.resolve('<p>revision 1</p>');
    await settle();
    controller.update(input({ revision: 2 }));
    expect(controller.getSnapshot()).toMatchObject({
      status: 'rendering',
      html: '<p>revision 1</p>',
    });
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    calls[1]?.deferred.reject(new Error('bad update'));
    await settle();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'error',
      html: '<p>revision 1</p>',
      error: 'bad update',
    });
  });

  it('emits status identity for document key and revision', async () => {
    const { calls, events } = setup(input({ key: 'resume-42', revision: 7 }));
    expect(events[0]).toEqual({
      documentKey: 'resume-42',
      revision: 7,
      status: 'rendering',
    });
    vi.advanceTimersByTime(DOCUMENT_DEBOUNCE_MS);
    calls[0]?.deferred.resolve('<p>ready</p>');
    await settle();
    expect(events.at(-1)).toEqual({
      documentKey: 'resume-42',
      revision: 7,
      status: 'ready',
    });
  });

  it('starts in the next cancellable task when configured with zero debounce', () => {
    const { calls } = setup(input(), 0);
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(0);
    expect(calls).toHaveLength(1);
  });

  it('does not start disposed zero-delay work during development effect replay', () => {
    const first = setup(input(), 0);
    first.controller.dispose();
    const second = setup(input(), 0);

    vi.advanceTimersByTime(0);

    expect(first.calls).toHaveLength(0);
    expect(second.calls).toHaveLength(1);
  });
});
