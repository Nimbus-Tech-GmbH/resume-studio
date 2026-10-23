import type { JsonResume } from '@resume-studio/transformer';

export interface PresentationInputV1 {
  readonly contractVersion: 1;
  readonly document: {
    readonly key: string;
    readonly revision: number;
    readonly resume: JsonResume;
  };
  readonly themeId: string;
}

export type PresentationStatus = 'idle' | 'rendering' | 'ready' | 'error';

export interface PresentationStatusEvent {
  readonly documentKey: string;
  readonly revision: number;
  readonly status: PresentationStatus;
}

export interface PresentationProps {
  readonly input: PresentationInputV1;
  readonly onStatusChange?: (event: PresentationStatusEvent) => void;
}
