import { abortActiveRequest } from '../features/ai-tailoring/requestController';
import { useTailoringStore } from '../features/ai-tailoring/state/tailoringStore';

export async function logoutAndReset(
  resetWorkspace: () => void,
  logout: () => Promise<void>,
): Promise<void> {
  abortActiveRequest();
  useTailoringStore.getState().interruptActiveRequest();
  useTailoringStore.getState().clearAll();
  resetWorkspace();
  await logout();
}
