// Purpose: one place that hears "the server said 401". client.ts (real mode) and the mock guard call it; AuthProvider
// registers what to do (forget the token, mark the session as ended). No React in here, so any file can use it.
let handler: (() => void) | null = null

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  handler = fn
}

export function handleUnauthorized(): void {
  handler?.()
}
