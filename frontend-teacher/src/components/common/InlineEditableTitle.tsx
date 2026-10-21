// Shared: changes need a PR note and a teammate review.
// Purpose: a heading that is its own text input. Its width follows the text (an invisible mirror span sizes it),
// a pencil sits right after the text, it shows a border on hover and a ring on focus, and Enter blurs it.
import type { Ref } from 'react'
import Icon from './Icon'

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** Names the field for screen readers. */
  label: string
  maxLength?: number
  inputRef?: Ref<HTMLInputElement>
}

export default function InlineEditableTitle({
  value,
  onChange,
  placeholder = 'Name this timing',
  label,
  maxLength = 30,
  inputRef,
}: Props) {
  const cell =
    '[grid-area:1/1] min-w-0 rounded-lg border border-transparent py-1 pl-1.5 pr-2.5 text-[19px] font-extrabold leading-[1.3] whitespace-pre'
  return (
    <label
      title="Click to rename"
      className="group inline-flex min-w-0 max-w-full cursor-text items-center gap-1.5 rounded-lg py-0.5 pl-0.5 pr-2 text-muted focus-within:[&_svg]:text-brand"
    >
      <span className="sr-only">{label}</span>
      <span className="inline-grid min-w-0 max-w-full">
        <span aria-hidden="true" className={`${cell} invisible overflow-hidden`}>
          {value || placeholder}
        </span>
        <input
          ref={inputRef}
          type="text"
          size={1}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className={`${cell} w-full bg-transparent text-ink placeholder:font-bold placeholder:text-muted group-hover:border-edge focus:border-brand focus:bg-field focus:shadow-[0_0_0_3px_var(--tint)] focus:outline-none`}
        />
      </span>
      <Icon name="pencil" size={16} strokeWidth={2} />
    </label>
  )
}
