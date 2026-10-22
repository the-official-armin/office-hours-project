// Shared: changes need a PR note and a teammate review.
// Purpose: form controls: a labelled field wrapper plus text input, select and textarea with the shared look.
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export const inputClass =
  'h-11 w-full rounded-[10px] border border-edge bg-field px-3 text-[15px] text-ink placeholder:text-muted disabled:opacity-60'

/** A real <label> that wraps its control, so the control is named by the text. */
export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-[13px] font-bold text-ink2 ${className}`}>
      {label}
      {children}
    </label>
  )
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} {...props} />
}

export function SelectInput({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputClass} ${className}`} {...props} />
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full resize-y rounded-[10px] border border-edge bg-field px-3 py-2.5 text-[15px] leading-normal text-ink placeholder:text-muted ${className}`}
      {...props}
    />
  )
}

/** Inline error under a form. Announced to screen readers. */
export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="text-sm font-semibold text-danger">
      {children}
    </p>
  )
}
