import { useEffect, useState } from 'react'

/**
 * Tracks whether the app currently renders the dark theme.
 * The `dark` class is on <html>; watch both system preference changes and
 * class mutations (theme switches apply the class synchronously).
 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains('dark'))
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return dark
}
