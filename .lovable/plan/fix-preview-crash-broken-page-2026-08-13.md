# Fix: preview crash / broken page

## What I found

The app itself is healthy right now:

- The dev server responds `200` on `/`, and the dev-server log has no errors.
- Loading `/`, `/auth`, and `/plans` in a real browser works: titles render, the auth gate correctly redirects `/plans` to `/auth?redirect=/plans`, and there are no runtime errors recorded.

Two real signals do show up:

1. The recorded network activity shows repeated `Failed to fetch` on the backend auth token-refresh call, retried several times before finally succeeding. That is a temporary connectivity blip in the preview tab — while it lasts, any code that awaits the auth call fails.
2. The `/auth` page logs a hydration mismatch warning in the browser console (server-rendered markup differs from the first client render). React recovers by re-rendering, so it is not the crash, but it is noise worth removing.

The "broken page" icon is the preview iframe failing to load the document, not an application exception — consistent with the connectivity blip above. What the app can control is how badly it degrades when a backend call fails mid-session.

## What to change

1. **Make the protected-route gate resilient to network failure.** Today `beforeLoad` on the authenticated section treats any error from the auth check as "not signed in" and, if the call throws outright, bubbles up into the full-page error screen. Change it to distinguish a genuine missing session (redirect to sign-in) from a transient network error (keep the existing session and let the page render, or show a small inline retry instead of a blank error page).

2. **Remove the `/auth` hydration mismatch.** Keep the first client render identical to the server render on that route so React does not discard and rebuild the tree.

3. **Add a lightweight offline/connection notice.** When backend calls fail due to connectivity, show a non-blocking toast ("Connection lost — retrying") rather than silently spinning or bouncing the user to sign-in.

4. **Re-verify end to end** in a headless browser after the changes: home, sign-in, and the protected pages, with the console captured, to confirm zero errors and no hydration warnings.

## Technical notes

- Files touched: `src/routes/_authenticated/route.tsx` (gate error handling), `src/routes/auth.tsx` (hydration), and a small shared helper for connection-error detection.
- No database, schema, or scheduling-engine changes.
- If the preview still shows the broken-page icon after this, the cause is outside the app code (preview tab connectivity); a hard reload of the preview restores it.
