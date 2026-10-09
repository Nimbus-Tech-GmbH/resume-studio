# Resume-Studio Web App Audit Report

**Date:** 2024  
**Focus:** `apps/web` security, refactoring, quality, and performance

---

## SECURITY ISSUES

### 🔴 CRITICAL

**1. Unencrypted Sensitive Data in localStorage (Print Payload)**
- **File:** `apps/web/src/editor/ExportMenu.tsx`, `apps/web/src/PrintPage.tsx`
- **Issue Type:** SECURITY
- **Severity:** CRITICAL
- **Description:**
  - Full resume + theme serialized as plaintext JSON stored in `localStorage` with timestamp key.
  - Any script (even from extensions/malicious CSP bypasses) can read full resume data.
  - No TTL enforcement—payload persists until manually cleaned.
  - Key is guessable (`print-${Date.now()}`); millisecond precision is insufficient.
- **Recommendation:**
  1. Use sessionStorage instead (cleared on tab close).
  2. Add server-side session tracking: store payload server-side, return opaque session token.
  3. If localStorage is required, encrypt payload with AES-GCM using a rotation key from IndexedDB.
  4. Enforce strict TTL (5 min) with server-side expiration check before rendering.
  5. Use cryptographically secure random key: `crypto.getRandomValues(new Uint8Array(16))`.

---

**2. Missing CSRF Token on GraphQL Mutations**
- **File:** `apps/web/src/graphql/client.ts`, `apps/web/src/graphql/executeSave.ts`
- **Issue Type:** SECURITY
- **Severity:** CRITICAL
- **Description:**
  - GraphQL mutations use `credentials: 'include'` for cookie-based auth but no CSRF token validation.
  - If session cookie is present (Better Auth), a crafted HTML page from another domain can trigger unwanted mutations.
  - Example: Attacker posts resume-studio link, victim visits attacker site which makes DELETE mutations.
- **Recommendation:**
  1. Better Auth should provide CSRF token in response headers; verify it's being used.
  2. Add X-CSRF-Token header to all GraphQL POST requests.
  3. Validate token server-side before executing mutations.
  4. Confirm Same-Site=Strict on the session cookie.

---

**3. Unvalidated User Input in Print Payload + Unsafe Render**
- **File:** `apps/web/src/PrintPage.tsx` (L36: `JSON.parse(payload)`), `apps/web/src/preview/PreviewFrame.tsx` (L89: `srcDoc={html}`)
- **Issue Type:** SECURITY (XSS)
- **Severity:** CRITICAL
- **Description:**
  - `localStorage.getItem()` is unparsed user-controlled data (attacker can inject via DevTools or extension).
  - No schema validation before parse; malicious JSON can trigger code paths.
  - Render service output (HTML) injected via `srcDoc` with `allow-scripts` sandbox.
  - If render service is compromised or exploited, arbitrary JS can execute in iframe (limited by sandbox but still risky).
- **Recommendation:**
  1. Validate print payload against a Zod schema before JSON.parse.
  2. Validate resume structure (resume.basics, resume.work, etc.) explicitly.
  3. Add Content-Security-Policy headers to PrintPage: `default-src 'none'; style-src 'unsafe-inline'` (if render output is CSS-only).
  4. Remove `allow-scripts` from iframe sandbox if render service only outputs HTML+CSS.
  5. Render service should output with `Content-Type: text/plain` or `application/xhtml+xml` instead of implicit HTML.

---

**4. Unsafe localStorage Key Extraction from URL**
- **File:** `apps/web/src/PrintPage.tsx` (L18: `new URLSearchParams(window.location.search)`)
- **Issue Type:** SECURITY (Parameter Injection)
- **Severity:** HIGH
- **Description:**
  - Print key comes directly from URL query param with no validation.
  - Attacker can craft link: `/?k=admin_resume_id` to probe for other users' print payloads.
  - No rate limiting or access control on localStorage retrieval.
- **Recommendation:**
  1. Validate key format: `^print-\d{13,}$` (timestamp-based pattern).
  2. Add rate limiting: max 5 print attempts per minute per tab.
  3. Log key access attempts for audit trail.
  4. Consider moving to session tokens instead of localStorage keys entirely.

---

### 🟠 HIGH

**5. Error Messages Leaking Resume Data**
- **File:** `apps/web/src/editor/SaveButton.tsx` (L44-46), `apps/web/src/preview/PreviewFrame.tsx` (L56)
- **Issue Type:** SECURITY (Information Disclosure)
- **Severity:** HIGH
- **Description:**
  - Toast displays field paths from validation errors: `"5 field error(s): /work/0/startDate, /education/2/endDate"`.
  - Error messages from render service included verbatim in UI (L56).
  - Attackers can infer schema structure and data presence.
- **Recommendation:**
  1. Log full error details server-side; show generic message to user: "Validation failed. Check individual fields."
  2. Limit preview errors to "Preview error" without details.
  3. Add error tracking (e.g., Sentry) for debugging.

---

**6. Fetch Requests Lack Integrity Checks**
- **File:** `apps/web/src/preview/renderClient.ts` (L16-22)
- **Issue Type:** SECURITY (MITM)
- **Severity:** HIGH
- **Description:**
  - POST to render service with no subresource integrity (SRI) verification.
  - Response is HTML injected into iframe with `srcDoc` – no signature verification.
  - MITM on render service endpoint can inject malicious CSS/HTML.
- **Recommendation:**
  1. Validate response Content-Type: `text/html; charset=utf-8`.
  2. Add optional: sign render output server-side with HMAC-SHA256; verify in client.
  3. Add Content-Security-Policy: `report-uri` to detect XSS attempts.
  4. Consider using render service's HTTPS certificate pinning.

---

**7. Auth Token Exposure in Console**
- **File:** `apps/web/src/auth/AuthContext.tsx` (L31-40: console.info/error with session data)
- **Issue Type:** SECURITY (XSS)
- **Severity:** MEDIUM → HIGH in deployed prod
- **Description:**
  - Session/auth response logged to console, including tokens.
  - Malicious userscript or extension can read console output.
  - Should be production-only or removed entirely.
- **Recommendation:**
  1. Remove console.info/error for auth flows or gate behind `isDev` check.
  2. Use server-side logging (Sentry, CloudWatch) instead.
  3. Audit all console calls for sensitive data before each release.

---

**8. Better Auth Credentials Not Validated**
- **File:** `apps/web/src/auth/authClient.ts`, `apps/web/src/graphql/client.ts`
- **Issue Type:** SECURITY
- **Severity:** HIGH
- **Description:**
  - Better Auth client defaults to current origin (`/api/auth`).
  - If Vite proxy to auth-service is misconfigured, client could connect to wrong endpoint.
  - No certificate pinning or server identity verification.
- **Recommendation:**
  1. Explicitly set authClient URL to `/api/auth` with origin check.
  2. Add tests verifying proxy routing (dev + staging).
  3. Validate auth-service response signature (JWT).

---

## REFACTORING OPPORTUNITIES

### 🟡 HIGH IMPACT

**9. Duplicate Debounce Patterns in PreviewFrame**
- **File:** `apps/web/src/preview/PreviewFrame.tsx`
- **Issue Type:** REFACTOR
- **Severity:** HIGH
- **Description:**
  - Two separate useEffect blocks both use `window.setTimeout` for debounce.
  - One debounces resume changes (L23-29), another debounces render request (L31-49).
  - Repeated timer cleanup logic and state management.
- **Recommendation:**
  1. Extract a `useDebounce` hook: `const debouncedResume = useDebounce(resume, 300)`.
  2. Consolidate into single useEffect watching `[debouncedResume, theme]`.
  3. Reusable across app (e.g., JSON editor auto-save).

---

**10. Props Drilling in EditorPane Tabs**
- **File:** `apps/web/src/editor/EditorPane.tsx`
- **Issue Type:** REFACTOR
- **Severity:** HIGH
- **Description:**
  - 11 separate form components (BasicsForm, WorkForm, etc.) all access `useEditorStore` independently.
  - No prop drilling shown, but each component re-renders on any store update.
  - Layout map (`TABS`) is hardcoded; adding sections requires code changes.
- **Recommendation:**
  1. Memoize each form component: `React.memo(BasicsForm)`.
  2. Extract section registry to const: `TABS` should be plugin-style.
  3. Use Zustand selectors to isolate component updates to their section only.

---

**11. Uncontrolled Form State in Dialog Components**
- **File:** `apps/web/src/editor/fields/HighlightsEditor.tsx`
- **Issue Type:** REFACTOR
- **Severity:** MEDIUM
- **Description:**
  - Multiple `useState` + `useRef` for edit index, highlights tracking.
  - `useCallback` dependencies chain (L24-31: `remove`, `commit`, etc.).
  - Mutable ref (`highlightsRef.current`) breaks React's data flow guarantees.
  - No test coverage for add/edit/remove orchestration.
- **Recommendation:**
  1. Use reducer pattern or Zustand for dialog state.
  2. Remove `useRef` for data tracking; use derived state instead.
  3. Add unit tests for edit/add/remove flows.

---

### 🟡 MEDIUM IMPACT

**12. Inconsistent Error Handling Across GraphQL/Render**
- **File:** `apps/web/src/graphql/executeSave.ts`, `apps/web/src/preview/renderClient.ts`, `apps/web/src/PrintPage.tsx`
- **Issue Type:** REFACTOR
- **Severity:** MEDIUM
- **Description:**
  - `executeSave`: per-op error capture with JSON.stringify fallback (L80).
  - `renderClient`: text response extraction with generic error (L24-25).
  - `PrintPage`: nested try-catch-finally with inline string checks (L24-53).
  - No consistent error serialization or error boundary.
- **Recommendation:**
  1. Create `ApiError` class with code, message, context.
  2. Standardize error responses from render service (JSON error object).
  3. Add error boundary component to wrap SaveButton + PrintPage.

---

**13. Type Safety Gaps in GraphQL Client**
- **File:** `apps/web/src/graphql/useResume.ts`
- **Issue Type:** REFACTOR (Type Safety)
- **Severity:** MEDIUM
- **Description:**
  - `ResumeListItem` interface is loose (`title?: string`, `language?: {...} | null`).
  - Response types not validated against actual schema.
  - `GetResumeResponse.resume` can be null but not explicitly handled in all call sites.
- **Recommendation:**
  1. Generate TS types from `schema.graphql` (e.g., graphql-codegen).
  2. Add Zod schemas for response validation.
  3. Test response parsing with schema validation on load.

---

**14. Hard-coded Endpoints Without Fallback**
- **File:** `apps/web/src/preview/renderClient.ts` (L4-5), `apps/web/src/graphql/client.ts` (L3-4)
- **Issue Type:** REFACTOR (Config)
- **Severity:** MEDIUM
- **Description:**
  - Two different endpoint defaults (localhost:8787, localhost:3000).
  - No centralized config; environment variables scattered.
  - No validation that endpoints are reachable on startup.
- **Recommendation:**
  1. Extract to `config.ts`: `{ GRAPHQL_ENDPOINT, RENDER_ENDPOINT }`.
  2. Add startup health check: ping both endpoints before rendering App.
  3. Add fallback UI if endpoints unreachable (e.g., "Backend is down").

---

## CODE QUALITY

### 🟠 HIGH PRIORITY

**15. Console Statements in Production Build**
- **File:** `apps/web/src/auth/AuthContext.tsx` (L31, 37, 40), `apps/web/src/editor/ExportMenu.tsx` (L35)
- **Issue Type:** QUALITY
- **Severity:** HIGH
- **Description:**
  - 4 console calls with eslint disables for "diagnostics" but no production check.
  - Even with disables, these leak auth flow details in DevTools.
  - Should use structured logging (Sentry, DataDog) instead.
- **Recommendation:**
  1. Add `if (__DEV__)` guards or environment-based logging wrapper.
  2. Replace with server-side logging for auth events.
  3. Keep only user-triggered errors visible.

---

**16. Missing Error Boundaries**
- **File:** `apps/web/src/App.tsx`, `apps/web/src/editor/EditorPane.tsx`
- **Issue Type:** QUALITY
- **Severity:** HIGH
- **Description:**
  - No error boundary component wrapping editor or preview panels.
  - If any child throws (e.g., JSON.parse in form), entire app crashes.
  - No graceful recovery path for users.
- **Recommendation:**
  1. Create `<ErrorBoundary>` component at app root.
  2. Add fallback UI: "Something went wrong. Reload to recover."
  3. Add error boundary around PreviewFrame and EditorPane separately.
  4. Log errors to Sentry with user context.

---

**17. Magic Numbers Without Constants**
- **File:** `apps/web/src/components/StartupDialog.tsx` (L67: `2_000`), `apps/web/src/preview/PreviewFrame.tsx` (L12: `300`)
- **Issue Type:** QUALITY
- **Severity:** MEDIUM
- **Description:**
  - Debounce delay (300ms) used in two places, not coordinated.
  - Flash duration (2000ms) hardcoded with no justification.
  - Intervals not documented or tested for performance impact.
- **Recommendation:**
  1. Extract to `constants.ts`: `DEBOUNCE_MS = 300`, `FLASH_DURATION_MS = 2000`.
  2. Add comments explaining tradeoff (e.g., "300ms balances responsiveness + server load").
  3. Add perf tests for debounce impact.

---

**18. Weak Regex Patterns**
- **File:** `apps/web/src/validation/schema.ts` (L27-28, L31)
- **Issue Type:** QUALITY
- **Severity:** MEDIUM
- **Description:**
  - EMAIL_REGEX: `/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/` doesn't match RFC 5322.
    - Fails on: `user+tag@example.co.uk`, subdomains, internationalized domains.
  - PHONE_REGEX: Too strict for international formats; only matches US patterns.
  - DATE_PATTERN: allows invalid dates like `2024-13-45`.
- **Recommendation:**
  1. Email: Use `z.string().email()` from zod (uses simple but safe pattern).
  2. Phone: Accept any numeric sequence, validate server-side via Twilio/SMS.
  3. Date: Parse with `date-fns.parseISO()` then check `isValid()`.

---

**19. Unused Variables and Dead Code**
- **File:** `apps/web/src/App.tsx` (L327: `const noop = () => {}`—never used or only used for missing close handler)
- **Issue Type:** QUALITY
- **Severity:** LOW
- **Description:**
  - `noop` on L327 is passed to `StartupDialog` but StartupDialog cannot close (L367: `onOpenChange={noop}`).
  - Startup dialog is modal; should not be dismissible (correct behavior) but code is confusing.
- **Recommendation:**
  1. Remove `noop` and `onOpenChange` prop if dialog is truly non-dismissible.
  2. Or add proper dismiss logic: logout on cancel.

---

**20. No JSDoc for Complex Logic**
- **File:** `apps/web/src/state/editorStore.ts` (L127-141: `buildIdMap`, `buildIdMapFromJson`)
- **Issue Type:** QUALITY
- **Severity:** MEDIUM
- **Description:**
  - ID map construction is subtle: `null` means "create", missing means "delete".
  - No explanation of invariants (e.g., why `cloneIdMap` is necessary).
  - Difficult for new contributors to understand.
- **Recommendation:**
  1. Add JSDoc with examples:
     ```typescript
     /**
      * Map CMS row IDs to resume section positions.
      * - null = locally added, needs create mutation
      * - missing from originalCmsIds = deleted locally, needs delete mutation
      * - present in both = exists on server
      */
     ```
  2. Add diagram comment in store file showing state transitions.

---

## PERFORMANCE

### 🟠 HIGH IMPACT

**21. Re-renders on Every Store Update**
- **File:** `apps/web/src/editor/EditorPane.tsx`
- **Issue Type:** PERF
- **Severity:** HIGH
- **Description:**
  - All 11 form components listen to entire `useEditorStore` (L12: `useEditorStore((s) => s.resume)`).
  - Any field change re-renders ALL tab contents.
  - When editing work experience, skills tab also re-renders (wasteful).
- **Recommendation:**
  1. Add Zustand selector per section:
     ```typescript
     const useWorkSection = (s) => ({ work: s.resume.work, patchResume: s.patchResume })
     ```
  2. Memoize form components: `React.memo(WorkForm)`.
  3. Measure: should drop re-render count from ~11 to ~1 per field change.

---

**22. Unbounded GraphQL Response Cache**
- **File:** `apps/web/src/main.tsx` (L11-12)
- **Issue Type:** PERF
- **Severity:** MEDIUM
- **Description:**
  - React Query: `staleTime: 30_000` (30s), no `cacheTime` specified.
  - Default cache retained for 5 minutes after query leaves UI.
  - Resume list + resume detail cached indefinitely; memory leak on long sessions.
- **Recommendation:**
  1. Add `gcTime: 60_000` (1 min) to limit cache memory.
  2. Add `networkMode: 'always'` to ensure fresh data on each tab focus.
  3. Test with DevTools: monitor query cache size over time.

---

**23. Debounce on Both Input + Render**
- **File:** `apps/web/src/preview/PreviewFrame.tsx`
- **Issue Type:** PERF
- **Severity:** MEDIUM
- **Description:**
  - Two debounce delays (300ms each) stack: typed text → 300ms → debounce state update → 300ms → render request = ~600ms perceived lag.
  - User expects instant feedback; 600ms is noticeable.
- **Recommendation:**
  1. Combine into single debounce: `const debouncedResume = useDebounce(resume, 300)`.
  2. Reduce to 200ms or use `requestIdleCallback` for lower priority renders.
  3. Show "updating preview…" spinner immediately, not after 600ms.

---

**24. Unnecessary useCallback Chains**
- **File:** `apps/web/src/components/StartupDialog.tsx` (L152-169)
- **Issue Type:** PERF
- **Severity:** LOW
- **Description:**
  - `dismiss`, `selectResume`, `createNew` all use `useCallback` with identical deps.
  - Multiple callbacks create closure overhead; most callbacks are small.
  - Likely premature optimization unless profiling shows issue.
- **Recommendation:**
  1. Measure with React Profiler: check if callback memoization prevents re-renders.
  2. If callbacks are <1KB, inline or remove `useCallback`.
  3. Keep `useCallback` only on expensive operations (list reorders, etc.).

---

### 🟡 MEDIUM PRIORITY

**25. N+1 Query Pattern in Resume List**
- **File:** `apps/web/src/graphql/useResume.ts` (L23-34, L36-48)
- **Issue Type:** PERF
- **Severity:** MEDIUM
- **Description:**
  - `useResumeList()` fetches all resumes (query 1).
  - Clicking a resume calls `useResume(id)` (query 2+).
  - GraphQL fragment `RESUME_FIELDS` may be loading user data per resume.
- **Recommendation:**
  1. Check if `LIST_RESUMES` includes lightweight version; use `GET_RESUME` for full details.
  2. Batch load resume details if clicking multiple resumes (rare, but possible).
  3. Add query waterfall timing test.

---

**26. Unused Imports**
- **File:** Scattered across codebase
- **Issue Type:** QUALITY
- **Severity:** LOW
- **Description:**
  - No full audit run, but likely some unused imports from refactoring.
  - TypeScript compiler doesn't warn; bundle bloat potential.
- **Recommendation:**
  1. Run `pnpm lint` with `eslint-plugin-unused-imports`.
  2. Add CI check to fail on unused imports.

---

## SUMMARY BY CATEGORY

| Category | Count | Top Severity |
|----------|-------|--------------|
| Security | 8 | CRITICAL (3) |
| Refactor | 6 | HIGH (3) |
| Quality | 6 | HIGH (3) |
| Perf | 5 | HIGH (2) |

### Critical Path (Do First)

1. **Print Payload Encryption** (Issue #1) — XSS/data leak
2. **CSRF Token Validation** (Issue #2) — Mutation hijacking
3. **Error Boundary** (Issue #16) — App stability
4. **localStorage Key Validation** (Issue #4) — Enumeration attack
5. **Pre-render Response Validation** (Issue #3) — XSS injection

### High-Value Quick Wins

- Extract `useDebounce` hook (Issue #9)
- Add error boundary (Issue #16)
- Remove console logs (Issue #15)
- Extract config constants (Issue #14)

---

## Testing Gaps

- No tests for print payload round-trip (storage → parse → render).
- No tests for GraphQL error handling per operation.
- No tests for auth token refresh on timeout.
- No tests for validation with edge-case resume data.
- Bundle size regression test missing.

---

## Deployment Checklist

Before production release:

- [ ] Remove all console.* statements or gate behind `isDev`.
- [ ] Enable CSRF token validation in auth-service.
- [ ] Encrypt print payloads or move to sessionStorage + server-side session.
- [ ] Validate `schema.graphql` against Keystone live schema.
- [ ] Add error tracking (Sentry) and health check endpoint.
- [ ] Audit localStorage for sensitive data (resume content must be encrypted).
- [ ] Enable CSP: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`.
- [ ] Test auth flow with Cognito in staging.
- [ ] Profile render frame re-renders (target: <100ms per keystroke).

---

**Report Generated:** 2024  
**Auditor:** Zed Agent  
**Next Review:** After implementing CRITICAL fixes (est. 1-2 weeks)
