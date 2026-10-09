import { GraphQLClient, ClientError } from 'graphql-request';

const ENDPOINT =
  import.meta.env.VITE_GRAPHQL_ENDPOINT ?? 'http://localhost:3000/api/graphql';

/**
 * Shared graphql-request client. `credentials: 'include'` carries the Keystone
 * session cookie (once Cognito is wired in a follow-up).
 * 
 * Errors logged from GraphQL responses may contain sensitive data — wrap in
 * error boundaries to prevent console leakage. See App.tsx ErrorBoundary.
 */
export const gqlClient = new GraphQLClient(ENDPOINT, {
  credentials: 'include',
  mode: 'cors',
});

export { ClientError };
