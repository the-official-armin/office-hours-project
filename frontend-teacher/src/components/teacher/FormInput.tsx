// Owner: Subgroup B (Teacher desktop UI). Labeled input.
import type { InputHTMLAttributes } from 'react'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export default function FormInput({ label, className = '', ...props }: FormInputProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input className={`w-full rounded border border-gray-300 px-2 py-1.5 ${className}`} {...props} />
    </label>
  )
}
