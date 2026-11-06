// Purpose: the screen shown while a saved sign-in is being checked, so the login page never flashes by.
export default function AuthSplash() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center gap-3 text-muted">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      Checking your sign-in...
    </div>
  )
}
