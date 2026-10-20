export function canListCmsResumes(isAuthenticated: boolean): boolean {
  return isAuthenticated;
}

export function canLoadCmsResume(id: string | null, isAuthenticated: boolean): boolean {
  return isAuthenticated && id !== null && id.length > 0;
}
