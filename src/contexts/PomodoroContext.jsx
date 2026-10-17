import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'

const Ctx = createContext(null)

export function PomodoroProvider({ children }) {
  const [settings, setSettingsState] = useState({ workMin: 25, breakMin: 5, longbreakMin: 15 })
  const [pom, setPom] = useState({
    mode: 'work',
    secondsLeft: 25 * 60,
    running: false,
    pomoCount: 0,
    taskTitle: '',
    taskId: null,
  })
  const intervalRef = useRef(null)

  function durations(s = settings) {
    return { work: s.workMin * 60, break: s.breakMin * 60, longbreak: s.longbreakMin * 60 }
  }

  useEffect(() => {
    if (!pom.running) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      return
    }

    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setPom(prev => {
        if (prev.secondsLeft <= 1) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          const newCount = prev.mode === 'work' ? prev.pomoCount + 1 : prev.pomoCount
          const newMode  = prev.mode === 'work'
            ? (newCount % 4 === 0 ? 'longbreak' : 'break')
            : 'work'
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Flowlyday 🍅', {
                body: prev.mode === 'work' ? '¡Pomodoro completo! Descansa.' : '¡Descanso terminado! A trabajar.',
              })
            }
          } catch (_) {}
          return { ...prev, running: false, mode: newMode, secondsLeft: durations()[newMode], pomoCount: newCount }
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 }
      })
    }, 1000)

    return () => { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [pom.running]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    setPom(p => ({ ...p, running: !p.running }))
  }, [])

  const reset = useCallback(() => {
    clearInterval(intervalRef.current); intervalRef.current = null
    setPom(p => ({ ...p, running: false, secondsLeft: durations()[p.mode] }))
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  const skip = useCallback(() => {
    clearInterval(intervalRef.current); intervalRef.current = null
    setPom(p => {
      const newCount = p.mode === 'work' ? p.pomoCount + 1 : p.pomoCount
      const newMode  = p.mode === 'work' ? (newCount % 4 === 0 ? 'longbreak' : 'break') : 'work'
      return { ...p, running: false, mode: newMode, secondsLeft: durations()[newMode], pomoCount: newCount }
    })
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  const setMode = useCallback((mode) => {
    clearInterval(intervalRef.current); intervalRef.current = null
    setPom(p => ({ ...p, running: false, mode, secondsLeft: durations()[mode] }))
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  const setTask = useCallback((taskId, taskTitle) => {
    setPom(p => ({ ...p, taskId, taskTitle }))
  }, [])

  const applySettings = useCallback((newSettings) => {
    clearInterval(intervalRef.current); intervalRef.current = null
    setSettingsState(newSettings)
    const d = durations(newSettings)
    setPom(p => ({ ...p, running: false, secondsLeft: d[p.mode] }))
  }, [])

  return (
    <Ctx.Provider value={{ pom, settings, toggle, reset, skip, setMode, setTask, applySettings }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePomodoro() { return useContext(Ctx) }

export function fmtPomTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
