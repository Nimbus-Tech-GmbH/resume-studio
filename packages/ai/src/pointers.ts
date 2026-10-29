export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function parsePointer(path: string): string[] {
  if (!path.startsWith('/')) throw new Error(`Invalid JSON pointer: ${path}`);
  return path
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export function resolvePointer(
  root: unknown,
  path: string,
): { found: boolean; value: unknown } {
  let current = root;
  for (const token of parsePointer(path)) {
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false, value: undefined };
      }
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, token)) {
      return { found: false, value: undefined };
    }
    current = current[token];
  }
  return { found: true, value: current };
}

export function setPointer(root: Record<string, unknown>, path: string, value: unknown): void {
  const tokens = parsePointer(path);
  if (tokens.length === 0) throw new Error('Cannot replace the document root.');
  let current: Record<string, unknown> | unknown[] = root;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = tokens[i]!;
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error(`Invalid JSON pointer: ${path}`);
      }
      current = current[index] as Record<string, unknown> | unknown[];
      continue;
    }
    const next = current[token];
    if (!isRecord(next) && !Array.isArray(next)) {
      current[token] = {};
      current = current[token] as Record<string, unknown>;
      continue;
    }
    current = next as Record<string, unknown> | unknown[];
  }
  const last = tokens[tokens.length - 1]!;
  if (Array.isArray(current)) {
    const index = Number(last);
    if (!Number.isInteger(index) || index < 0 || index >= current.length) {
      throw new Error(`Invalid JSON pointer: ${path}`);
    }
    current[index] = value;
    return;
  }
  current[last] = value;
}

export function deletePointer(root: Record<string, unknown>, path: string): void {
  const tokens = parsePointer(path);
  if (tokens.length === 0) throw new Error('Cannot delete the document root.');
  let current: Record<string, unknown> | unknown[] = root;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = tokens[i]!;
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return;
      current = current[index] as Record<string, unknown> | unknown[];
      continue;
    }
    const next = current[token];
    if (!isRecord(next) && !Array.isArray(next)) return;
    current = next as Record<string, unknown> | unknown[];
  }
  const last = tokens[tokens.length - 1]!;
  if (Array.isArray(current)) {
    const index = Number(last);
    if (Number.isInteger(index) && index >= 0 && index < current.length) {
      current.splice(index, 1);
    }
    return;
  }
  delete current[last];
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!deepEqual(left[key], right[key])) return false;
  }
  return true;
}

export function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
