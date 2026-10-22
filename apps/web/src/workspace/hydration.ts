// Pure helpers for workspace hydration state.
// Kept dependency-free so they can be unit tested without a DOM.

/** True when the recovered workspace belongs to the scope currently in use. */
export function isScopeHydrated(
  hydratedScope: string | null,
  scope: string,
): boolean {
  return hydratedScope !== null && hydratedScope === scope;
}

/**
 * The startup dialog must stay closed until workspace recovery for the active
 * scope has finished. Otherwise it opens on first paint and snaps shut a frame
 * later, when the restored record clears `isStartup`.
 */
export function shouldShowStartupDialog(
  isStartup: boolean,
  hydrated: boolean,
): boolean {
  return isStartup && hydrated;
}

/**
 * True when the active scope changed from a signed-in account back to guest.
 * Logging out resets the store and must reopen the startup dialog.
 */
export function isLogoutTransition(
  previousScope: string | null,
  scope: string,
): boolean {
  return (
    previousScope !== null &&
    previousScope.startsWith('account:') &&
    scope === 'guest'
  );
}

/**
 * Startup state after a workspace restore. A restored workspace keeps the
 * startup state it was saved with, so a reload taken before the user picked a
 * resume still shows the dialog. Logging out always reopens it.
 */
export function resolveStartupAfterRestore(
  isLogout: boolean,
  persistedIsStartup: boolean,
): boolean {
  return isLogout || Boolean(persistedIsStartup);
}
