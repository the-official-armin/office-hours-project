// Shared: changes need a PR note and a teammate review.
// Purpose: sidebar open/closed state, remembered in localStorage, toggled with Ctrl/Cmd+B on wide screens.
import { useCallback, useEffect, useState } from 'react'

const KEY = 'officehours.sidebar'
const WIDE = 900

function readOpen(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'closed'
  } catch {
    return true
  }
}

export function useSidebar() {
  const [open, setOpen] = useState(readOpen)

  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current
      try {
        localStorage.setItem(KEY, next ? 'open' : 'closed')
      } catch {
        // storage unavailable: the choice lasts until the page reloads
      }
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'b') return
      if (window.innerWidth < WIDE || document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      toggle()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggle])

  return { open, toggle }
}
