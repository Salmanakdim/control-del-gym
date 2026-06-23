import { useState } from 'react'

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })

  const set = (next) => {
    const resolved = typeof next === 'function' ? next(value) : next
    setValue(resolved)
    localStorage.setItem(key, JSON.stringify(resolved))
  }

  return [value, set]
}
