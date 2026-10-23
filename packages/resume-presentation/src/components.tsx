import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { PresentationInputV1, PresentationProps } from '@resume-studio/studio-contracts';
import {
  createInitialPresentationSnapshot,
  createPresentationController,
  DOCUMENT_DEBOUNCE_MS,
  type PresentationController,
  type PresentationSnapshot,
  type PresentationTransport,
} from './controller';
import { defaultPresentationTransport } from './httpTransport';
import './styles.css';

export const PREVIEW_IFRAME_SANDBOX = 'allow-same-origin';
export const PRINT_IFRAME_SANDBOX = 'allow-same-origin allow-modals';

export interface PresentationComponentProps extends PresentationProps {
  readonly transport?: PresentationTransport;
  readonly className?: string;
  readonly title?: string;
  readonly sandbox?: string;
}

export interface PrintPresentationActions {
  readonly canPrint: boolean;
  print(): void;
}

export interface PrintPresentationProps extends PresentationComponentProps {
  readonly renderToolbar?: (actions: PrintPresentationActions) => ReactNode;
}

interface PresentationLifecycle {
  readonly snapshot: PresentationSnapshot;
  retry(): void;
}

function usePresentationLifecycle(
  input: PresentationInputV1,
  transport: PresentationTransport,
  onStatusChange: PresentationProps['onStatusChange'],
  debounceMs: number,
): PresentationLifecycle {
  const [snapshot, setSnapshot] = useState(() => createInitialPresentationSnapshot(input));
  const controllerRef = useRef<PresentationController | null>(null);
  const inputRef = useRef(input);
  const onStatusChangeRef = useRef(onStatusChange);
  inputRef.current = input;
  onStatusChangeRef.current = onStatusChange;

  useLayoutEffect(() => {
    const controller = createPresentationController(inputRef.current, {
      transport,
      debounceMs,
      onChange: setSnapshot,
      onStatusChange: (event) => onStatusChangeRef.current?.(event),
    });
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
      controller.dispose();
    };
  }, [debounceMs, transport]);

  useLayoutEffect(() => {
    controllerRef.current?.update(input);
  }, [input]);

  const retry = useCallback(() => controllerRef.current?.retry(), []);
  const snapshotMatchesInput =
    snapshot.input.document.key === input.document.key &&
    snapshot.input.document.revision === input.document.revision &&
    snapshot.input.themeId === input.themeId;
  const visibleSnapshot: PresentationSnapshot = snapshotMatchesInput
    ? snapshot
    : {
        status: 'rendering',
        html: snapshot.input.document.key === input.document.key ? snapshot.html : null,
        error: null,
        input,
      };
  return { snapshot: visibleSnapshot, retry };
}

interface PresentationSurfaceProps {
  readonly snapshot: PresentationSnapshot;
  readonly retry: () => void;
  readonly iframeRef?: RefObject<HTMLIFrameElement | null>;
  readonly className?: string;
  readonly title: string;
  readonly sandbox: string;
  readonly toolbar?: ReactNode;
}

function PresentationSurface({
  snapshot,
  retry,
  iframeRef,
  className,
  title,
  sandbox,
  toolbar,
}: PresentationSurfaceProps) {
  const classes = className ? `rs-presentation ${className}` : 'rs-presentation';
  const hasHtml = snapshot.html !== null;

  return (
    <section className={classes} data-status={snapshot.status}>
      {toolbar}
      <div className="rs-presentation__viewport">
        {hasHtml ? (
          <iframe
            ref={iframeRef}
            className="rs-presentation__frame"
            title={title}
            sandbox={sandbox}
            srcDoc={snapshot.html ?? ''}
          />
        ) : null}

        {snapshot.status === 'rendering' ? (
          <div
            className={hasHtml ? 'rs-presentation__updating' : 'rs-presentation__loading'}
            role="status"
            aria-label={hasHtml ? 'Updating presentation' : 'Loading presentation'}
          >
            {hasHtml ? null : (
              <div className="rs-presentation__loading-card" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        ) : null}

        {snapshot.status === 'error' ? (
          <div
            className={
              hasHtml
                ? 'rs-presentation__error rs-presentation__error--retained'
                : 'rs-presentation__error'
            }
            role="alert"
          >
            <strong>Presentation update failed</strong>
            <span>{snapshot.error}</span>
            <button className="rs-presentation__button" type="button" onClick={retry}>
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PreviewPresentation({
  input,
  transport = defaultPresentationTransport,
  onStatusChange,
  className,
  title = 'Resume preview',
  sandbox = PREVIEW_IFRAME_SANDBOX,
}: PresentationComponentProps) {
  const lifecycle = usePresentationLifecycle(
    input,
    transport,
    onStatusChange,
    DOCUMENT_DEBOUNCE_MS,
  );
  return (
    <PresentationSurface
      snapshot={lifecycle.snapshot}
      retry={lifecycle.retry}
      className={className}
      title={title}
      sandbox={sandbox}
    />
  );
}

export function PrintPresentation({
  input,
  transport = defaultPresentationTransport,
  onStatusChange,
  className,
  title = 'Resume print preview',
  sandbox = PRINT_IFRAME_SANDBOX,
  renderToolbar,
}: PrintPresentationProps) {
  const lifecycle = usePresentationLifecycle(input, transport, onStatusChange, 0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const print = useCallback(() => {
    iframeRef.current?.contentWindow?.print();
  }, []);
  const canPrint = lifecycle.snapshot.html !== null;
  const toolbar = renderToolbar ? (
    renderToolbar({ canPrint, print })
  ) : (
    <div className="rs-presentation__toolbar">
      <button
        className="rs-presentation__button"
        type="button"
        onClick={print}
        disabled={!canPrint}
      >
        Print
      </button>
    </div>
  );

  return (
    <PresentationSurface
      snapshot={lifecycle.snapshot}
      retry={lifecycle.retry}
      iframeRef={iframeRef}
      className={className}
      title={title}
      sandbox={sandbox}
      toolbar={toolbar}
    />
  );
}
