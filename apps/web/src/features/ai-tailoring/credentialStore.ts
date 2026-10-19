let activeApiKey = '';

export function setTailoringApiKey(value: string): void {
  activeApiKey = value.trim();
}

export function getTailoringApiKey(): string {
  return activeApiKey;
}

export function clearTailoringApiKey(): void {
  activeApiKey = '';
}
