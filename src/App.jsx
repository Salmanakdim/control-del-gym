import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Routines from './pages/Routines'
import WorkoutLog from './pages/WorkoutLog'
import Progress from './pages/Progress'
import Exercises from './pages/Exercises'
import Auth from './pages/Auth'
import { useLocalStorage } from './hooks/useLocalStorage'
import { SEED_ROUTINES, SEED_LOGS } from './store/gymStore'

function AppInner() {
  const { user } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [routines, setRoutines] = useLocalStorage('gym_routines', SEED_ROUTINES)
  const [logs, setLogs] = useLocalStorage('gym_logs', SEED_LOGS)

  // Loading
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not logged in
  if (user === null) return <Auth />

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar page={page} setPage={setPage} />
      <main className="flex-1 pt-16 px-4 pb-6 lg:pt-8 lg:px-8 lg:pb-8 overflow-y-auto lg:ml-0">
        <div className={page === 'exercises' ? 'max-w-6xl mx-auto' : 'max-w-5xl mx-auto'}>
          {page === 'dashboard' && <Dashboard logs={logs} routines={routines} setPage={setPage} />}
          {page === 'routines'  && <Routines routines={routines} setRoutines={setRoutines} />}
          {page === 'log'       && <WorkoutLog routines={routines} logs={logs} setLogs={setLogs} setPage={setPage} />}
          {page === 'exercises' && <Exercises logs={logs} />}
          {page === 'progress'  && <Progress logs={logs} />}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
