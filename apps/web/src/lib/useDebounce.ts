import { useState, useEffect } from 'react'

/** Retourne une version différée de `value` : ne change que `delay` ms après le
 *  dernier changement. Utilisé pour ne pas requêter à chaque frappe. */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
