// Shared: changes need a PR note and a teammate review.
// Purpose: buttons. Button (with a pending state), LinkButton (a link that looks like a button), IconButton, TextLink.
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variant = 'default' | 'primary' | 'danger' | 'dangerfill'

const VARIANTS: Record<Variant, string> = {
  default: 'border-edge bg-surface text-ink',
  primary: 'border-brand bg-brand text-on-brand',
  danger: 'border-edge bg-surface text-danger',
  dangerfill: 'border-danger-fill bg-danger-fill text-white',
}

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border px-[18px] text-sm font-bold no-underline disabled:cursor-default disabled:opacity-45'

export const buttonClass = (variant: Variant = 'default', block = false, extra = '') =>
  `${BASE} ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${extra}`

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  block?: boolean
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

export default function Button({
  variant = 'default',
  block = false,
  loading = false,
  disabled,
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, block, className)}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}

export function LinkButton({
  variant = 'default',
  block = false,
  className = '',
  ...props
}: LinkProps & { variant?: Variant; block?: boolean }) {
  return <Link className={buttonClass(variant, block, className)} {...props} />
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only button needs a name. */
  'aria-label': string
  ghost?: boolean
  ref?: Ref<HTMLButtonElement>
  children: ReactNode
}

export function IconButton({ ghost = false, className = '', type = 'button', children, ...props }: IconButtonProps) {
  const look = ghost
    ? 'border-transparent bg-transparent text-muted hover:border-edge hover:text-danger'
    : 'border-edge bg-surface text-ink'
  return (
    <button
      type={type}
      className={`relative inline-flex h-11 w-11 flex-none items-center justify-center rounded-[10px] border p-0 text-[22px] font-bold disabled:cursor-default disabled:opacity-45 ${look} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** A button that reads as a link. */
export function TextButton({ className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`border-0 bg-transparent p-0 text-sm font-bold text-link ${className}`} {...props} />
}

/** A pill toggle (aria-pressed), used for days, filters, tabs and reminder times. */
export function Pill({
  pressed,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={`min-h-11 rounded-[10px] border px-[18px] text-sm font-bold ${
        pressed ? 'border-brand bg-brand text-on-brand' : 'border-edge bg-surface text-ink'
      } ${className}`}
      {...props}
    />
  )
}
