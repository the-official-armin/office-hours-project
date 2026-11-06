// Purpose: the frame of every sign-in screen: a centered card (max 420px) and, from 1024px, a deep-navy brand panel with the crest.
import type { ReactNode } from 'react'
import SchoolLogo from '../common/SchoolLogo'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside
        aria-hidden="true"
        className="hidden w-[42%] max-w-[560px] flex-none flex-col justify-between bg-panel p-12 text-panel-ink min-[1024px]:flex"
      >
        <SchoolLogo size={72} ring />
        <div>
          <p className="text-[34px] font-extrabold leading-tight tracking-tight">Washington Prep Office Hours</p>
          <p className="mt-3 max-w-[340px] text-base text-panel-mute">Book a spot with a teacher, or manage your office hours.</p>
        </div>
        <p className="text-sm text-panel-mute">Washington Preparatory School</p>
      </aside>

      <main className="flex min-w-0 flex-1 items-center justify-center px-[max(16px,env(safe-area-inset-right,0px))] py-8">
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          <div className="flex items-center gap-3 min-[1024px]:hidden">
            <SchoolLogo size={44} />
            <b className="text-base font-extrabold">Washington Prep Office Hours</b>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
