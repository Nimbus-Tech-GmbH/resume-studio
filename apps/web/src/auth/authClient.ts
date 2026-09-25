import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client. Ships a plain fetch ObservableQuery for React; base
 * URL defaults to the current origin, which proxies `/api/auth` to the
 * auth-service in both dev (Vite) and prod (render-service).
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;