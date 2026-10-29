let activeController: AbortController | null = null;
let activeRequestId: string | null = null;

export function startRequestController(requestId: string): AbortSignal {
  abortActiveRequest();
  activeController = new AbortController();
  activeRequestId = requestId;
  return activeController.signal;
}

export function abortActiveRequest(): void {
  if (activeController) {
    activeController.abort();
  }
  activeController = null;
  activeRequestId = null;
}

export function finishRequestController(requestId: string): void {
  if (activeRequestId === requestId) {
    activeController = null;
    activeRequestId = null;
  }
}

export function getActiveRequestId(): string | null {
  return activeRequestId;
}
