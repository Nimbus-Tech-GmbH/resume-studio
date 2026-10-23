import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PresentationInputV1, PresentationStatusEvent } from '@resume-studio/studio-contracts';
import {
  createHttpPresentationTransport,
  PreviewPresentation,
  PrintPresentation,
  type PresentationTransport,
} from '@resume-studio/resume-presentation';
import { emptyResume, harnessThemeIds, populatedResume } from './fixtures';
import './styles.css';

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        const error = new Error('cancelled');
        error.name = 'AbortError';
        reject(error);
      },
      { once: true },
    );
  });
}

function Harness() {
  const [fixture, setFixture] = useState<'populated' | 'empty'>('populated');
  const [themeId, setThemeId] = useState<string>(harnessThemeIds[0]);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('idle');
  const slowNext = useRef(false);
  const failNext = useRef(false);
  const baseTransport = useMemo(() => createHttpPresentationTransport(), []);
  const transport = useMemo<PresentationTransport>(() => {
    return async (input, signal) => {
      if (slowNext.current) {
        slowNext.current = false;
        await wait(1_500, signal);
      }
      if (failNext.current) {
        failNext.current = false;
        throw new Error('Synthetic harness failure');
      }
      return baseTransport(input, signal);
    };
  }, [baseTransport]);
  const input = useMemo<PresentationInputV1>(() => {
    const base = fixture === 'populated' ? populatedResume : emptyResume;
    return {
      contractVersion: 1,
      document: {
        key: fixture,
        revision,
        resume: {
          ...base,
          meta: { ...base.meta, title: `Harness revision ${revision}` },
        },
      },
      themeId,
    };
  }, [fixture, revision, themeId]);
  const onStatusChange = (event: PresentationStatusEvent): void => {
    setStatus(`${event.status}: ${event.documentKey}@${event.revision}`);
  };
  const changeDocument = (): void => setRevision((value) => value + 1);
  const rapidChanges = (): void => {
    changeDocument();
    setTimeout(changeDocument, 75);
    setTimeout(changeDocument, 150);
  };

  return (
    <main className="harness">
      <h1>Resume presentation harness</h1>
      <div className="harness__controls">
        <label>
          Fixture{' '}
          <select
            value={fixture}
            onChange={(event) => setFixture(event.target.value === 'empty' ? 'empty' : 'populated')}
          >
            <option value="populated">Populated</option>
            <option value="empty">Empty</option>
          </select>
        </label>
        <label>
          Theme{' '}
          <select value={themeId} onChange={(event) => setThemeId(event.target.value)}>
            {harnessThemeIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={changeDocument}>
          Edit document
        </button>
        <button type="button" onClick={rapidChanges}>
          Rapid edits
        </button>
        <button
          type="button"
          onClick={() => {
            slowNext.current = true;
            changeDocument();
          }}
        >
          Slow next render
        </button>
        <button
          type="button"
          onClick={() => {
            failNext.current = true;
            changeDocument();
          }}
        >
          Fail next render
        </button>
      </div>
      <div className="harness__status" role="status">
        Status: {status}; revision: {revision}
      </div>
      <div className="harness__grid">
        <section className="harness__panel">
          <h2>Preview</h2>
          <PreviewPresentation
            className="harness__presentation"
            input={input}
            transport={transport}
            onStatusChange={onStatusChange}
          />
        </section>
        <section className="harness__panel">
          <h2>Print</h2>
          <PrintPresentation
            className="harness__presentation"
            input={input}
            transport={transport}
          />
        </section>
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');
createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
