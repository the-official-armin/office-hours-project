// Purpose: one place that hears "the server said 401". client.ts (real mode) and the mock guard call it; AuthProvider
// registers what to do (forget the token, mark the session as ended). No React in here, so any file can use it.
// It also holds the "refresh the token before it runs out" step that client.ts runs before each request.
let handler: (() => void) | null = null
let refresher: (() => Promise<void>) | null = null
let refreshing: Promise<void> | null = null

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  handler = fn
}

export function handleUnauthorized(): void {
  handler?.()
}

export function setRefresher(fn: (() => Promise<void>) | null): void {
  refresher = fn
}

/** Swaps the token for a fresh one when it is about to run out (AuthProvider decides when). Requests that arrive together
 * share one refresh, and a failed refresh is ignored: the request goes ahead and a 401 ends the session as usual. */
export function refreshIfNeeded(): Promise<void> {
  if (!refresher) return Promise.resolve()
  const run = refresher
  refreshing ??= run()
    .catch(() => undefined)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}
