// Owner: Subgroup B (Teacher desktop UI). Labeled input (a real label wraps the control).
import type { InputHTMLAttributes } from 'react'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export default function FormInput({ label, hint, className = '', ...props }: FormInputProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-semibold text-ink">{label}</span>
      <input
        className={`w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted disabled:opacity-60 ${className}`}
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}
