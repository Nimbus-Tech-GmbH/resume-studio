/* eslint-disable react-refresh/only-export-components -- legitimate context provider + hook pattern */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { signIn, signOut, useSession } from './authClient';

interface AuthState {
  isAuthenticated: boolean;
  /** True while the initial session check is in flight. */
  isLoading: boolean;
  /** Start the Cognito OAuth flow (redirect to hosted UI). */
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  const value = useMemo<AuthState>(() => {
    const isAuthenticated = Boolean(session?.user);
    return {
      isAuthenticated,
      isLoading: isPending,
      login: async () => {
        await signIn.social({ provider: 'cognito' });
      },
      logout: async () => {
        await signOut();
      },
    };
  }, [session, isPending]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}