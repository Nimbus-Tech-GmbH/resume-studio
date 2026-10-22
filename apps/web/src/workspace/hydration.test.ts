import { describe, expect, it } from 'vitest';
import {
  isLogoutTransition,
  isScopeHydrated,
  resolveStartupAfterRestore,
  shouldShowStartupDialog,
} from './hydration';

describe('isScopeHydrated', () => {
  it('is not hydrated before any scope was recovered', () => {
    expect(isScopeHydrated(null, 'guest')).toBe(false);
  });

  it('is hydrated when the recovered scope matches the active scope', () => {
    expect(isScopeHydrated('guest', 'guest')).toBe(true);
  });

  it('is not hydrated after the active scope changed', () => {
    expect(isScopeHydrated('account:u1', 'guest')).toBe(false);
    expect(isScopeHydrated('guest', 'account:u1')).toBe(false);
  });
});

describe('shouldShowStartupDialog', () => {
  it('stays closed while hydration is pending', () => {
    expect(shouldShowStartupDialog(true, false)).toBe(false);
  });

  it('stays closed when a restored workspace already holds the resume', () => {
    expect(shouldShowStartupDialog(false, true)).toBe(false);
  });

  it('opens once hydration finishes and no workspace was restored', () => {
    expect(shouldShowStartupDialog(true, true)).toBe(true);
  });
});

describe('isLogoutTransition', () => {
  it('is false on the first load', () => {
    expect(isLogoutTransition(null, 'guest')).toBe(false);
    expect(isLogoutTransition(null, 'account:u1')).toBe(false);
  });

  it('is true when an account scope hands back to guest', () => {
    expect(isLogoutTransition('account:u1', 'guest')).toBe(true);
  });

  it('is false when signing in', () => {
    expect(isLogoutTransition('guest', 'account:u1')).toBe(false);
  });

  it('is false when switching between accounts', () => {
    expect(isLogoutTransition('account:u1', 'account:u2')).toBe(false);
  });
});

describe('resolveStartupAfterRestore', () => {
  it('reopens the dialog after logout', () => {
    expect(resolveStartupAfterRestore(true, false)).toBe(true);
  });

  it('keeps the persisted startup state on a normal restore', () => {
    expect(resolveStartupAfterRestore(false, false)).toBe(false);
    expect(resolveStartupAfterRestore(false, true)).toBe(true);
  });
});
