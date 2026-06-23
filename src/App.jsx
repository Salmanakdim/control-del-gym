import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Routines from './pages/Routines'
import WorkoutLog from './pages/WorkoutLog'
import Progress from './pages/Progress'
import Exercises from './pages/Exercises'
import { useLocalStorage } from './hooks/useLocalStorage'
import { SEED_ROUTINES, SEED_LOGS } from './store/gymStore'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [routines, setRoutines] = useLocalStorage('gym_routines', SEED_ROUTINES)
  const [logs, setLogs] = useLocalStorage('gym_logs', SEED_LOGS)

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
