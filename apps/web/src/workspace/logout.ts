export async function logoutAndReset(
  resetWorkspace: () => void,
  logout: () => Promise<void>,
): Promise<void> {
  resetWorkspace();
  await logout();
}
