import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PomodoroProvider, usePomodoro, fmtPomTime } from './contexts/PomodoroContext'
import { supabase } from './lib/supabase'
import { requestNotificationPermission, createNotificationChannel, scheduleDailyNotifications } from './lib/notifications'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import Routines from './pages/Routines'
import WorkoutLog from './pages/WorkoutLog'
import Progress from './pages/Progress'
import Exercises from './pages/Exercises'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import Habits from './pages/Habits'
import Pomodoro from './pages/Pomodoro'
import Notes from './pages/Notes'
import Respiracion from './pages/Respiracion'
import Sueno from './pages/Sueno'
import Cuerpo from './pages/Cuerpo'
import Afirmaciones from './pages/Afirmaciones'
import Metas from './pages/Metas'
import Ajustes from './pages/Ajustes'
import Revision from './pages/Revision'
import Auth from './pages/Auth'
import { Play, Pause } from 'lucide-react'

// Barra de abajo (Inicio, Entreno, Hábitos…) desactivada de momento; en el móvil
// se navega con el menú ☰. Para volver a mostrarla, poner true.
const SHOW_BOTTOM_NAV = false

const MODE_COLORS = { work: '#2563eb', break: '#16a34a', longbreak: '#7c3aed' }
const MODE_LABELS = { work: 'Trabajando', break: 'Descansando', longbreak: 'Descanso largo' }

function adaptRoutine(r) {
  return { id: r.id, name: r.name, exercises: r.exercises || [] }
}
function adaptLog(l) {
  return {
    id: l.id, date: l.date,
    routineId: l.routine_id, routineName: l.routine_name,
    durationMin: l.duration_min, exercises: l.exercises || [], notes: l.notes,
  }
}

function AppInner() {
  const { user } = useAuth()
  const { pom, toggle } = usePomodoro()
  const [page, setPage] = useState('dashboard')
  const [tasksInitialView, setTasksInitialView] = useState('home')
  const [routines, setRoutines] = useState([])
  const [logs, setLogs] = useState([])
  const [gymLoading, setGymLoading] = useState(true)
  const [gymStartRoutineId, setGymStartRoutineId] = useState(null)

  function navigate(pageId, tasksView = 'home') {
    if (pageId === 'tasks') setTasksInitialView(tasksView)
    setPage(pageId)
  }

  function startRoutineFromDashboard(routineId) {
    setGymStartRoutineId(routineId)
    setPage('log')
  }

  useEffect(() => {
    if (user) {
      loadGymData()
      createNotificationChannel().then(() =>
        requestNotificationPermission().then(granted => {
          if (granted) scheduleDailyNotifications()
        })
      )
    }
    // Solo al entrar con otro usuario: guardar la config del camino (updateUser) o
    // renovar la sesión también cambian `user`, y recargar aquí desmontaba el inicio.
  }, [user?.id])

  async function loadGymData() {
    setGymLoading(true)
    const [{ data: r }, { data: l }] = await Promise.all([
      supabase.from('routines').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('workout_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    ])
    setRoutines((r || []).map(adaptRoutine))
    setLogs((l || []).map(adaptLog))
    setGymLoading(false)
  }

  async function saveRoutine(routine) {
    const payload = { name: routine.name, exercises: routine.exercises, user_id: user.id }
    const existing = routines.find(r => r.id === routine.id)
    if (existing) {
      await supabase.from('routines').update(payload).eq('id', routine.id)
      setRoutines(prev => prev.map(r => r.id === routine.id ? routine : r))
    } else {
      const { data } = await supabase.from('routines').insert(payload).select().single()
      if (data) setRoutines(prev => [...prev, adaptRoutine(data)])
    }
  }

  async function deleteRoutine(id) {
    await supabase.from('routines').delete().eq('id', id)
    setRoutines(prev => prev.filter(r => r.id !== id))
  }

  async function addLog(log) {
    const payload = {
      user_id: user.id, date: log.date,
      routine_id: log.routineId || null, routine_name: log.routineName,
      duration_min: log.durationMin, exercises: log.exercises, notes: log.notes || null,
    }
    const { data } = await supabase.from('workout_logs').insert(payload).select().single()
    if (data) setLogs(prev => [adaptLog(data), ...prev])
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user === null) return <Auth />

  const isTasks    = page === 'tasks'
  const isPersonal = ['habits', 'pomodoro', 'notes', 'respiracion', 'sueno', 'cuerpo', 'afirmaciones', 'metas', 'ajustes', 'revision'].includes(page)

  const showPomBar = pom.running && page !== 'pomodoro'

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar page={page} setPage={navigate} />
      {SHOW_BOTTOM_NAV && <BottomNav page={page} setPage={navigate} />}

      {isTasks ? (
        <main className="flex-1">
          <Tasks initialView={tasksInitialView} />
        </main>
      ) : (
        <main className="flex-1 pt-16 px-4 pb-24 lg:pt-8 lg:px-8 lg:pb-8 overflow-y-auto lg:ml-0">
          <div className={page === 'exercises' ? 'max-w-6xl mx-auto' : 'max-w-5xl mx-auto'}>
            {isPersonal ? (
              <>
                {page === 'habits'      && <Habits />}
                {page === 'pomodoro'   && <Pomodoro />}
                {page === 'notes'      && <Notes />}
                {page === 'respiracion' && <Respiracion />}
                {page === 'sueno'       && <Sueno />}
                {page === 'cuerpo'        && <Cuerpo />}
                {page === 'afirmaciones'  && <Afirmaciones />}
                {page === 'metas'         && <Metas />}
                {page === 'ajustes'       && <Ajustes />}
                {page === 'revision'      && <Revision />}
              </>
            ) : gymLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {page === 'dashboard' && <Dashboard logs={logs} routines={routines} setPage={navigate} onStartRoutine={startRoutineFromDashboard} />}
                {page === 'calendar'  && <Calendar logs={logs} />}
                {page === 'routines'  && <Routines routines={routines} onSaveRoutine={saveRoutine} onDeleteRoutine={deleteRoutine} />}
                {page === 'log'       && <WorkoutLog routines={routines} logs={logs} onAddLog={addLog} setPage={setPage} startRoutineId={gymStartRoutineId} onStartRoutineConsumed={() => setGymStartRoutineId(null)} onSaveRoutine={saveRoutine} onDeleteRoutine={deleteRoutine} />}
                {page === 'exercises' && <Exercises logs={logs} />}
                {page === 'progress'  && <Progress logs={logs} />}
              </>
            )}
          </div>
        </main>
      )}

      {/* Pomodoro mini bar */}
      {showPomBar && (
        <div
          className="fixed bottom-5 left-4 right-4 lg:left-64 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
          style={{ background: MODE_COLORS[pom.mode], maxWidth: 420, margin: '0 auto' }}>
          <span className="text-xl flex-shrink-0">🍅</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-none">{MODE_LABELS[pom.mode]}</p>
            {pom.taskTitle && (
              <p className="text-white/70 text-xs mt-0.5 truncate">{pom.taskTitle}</p>
            )}
          </div>
          <span className="text-white font-black text-lg tabular-nums">{fmtPomTime(pom.secondsLeft)}</span>
          <button onClick={toggle}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 active:bg-white/30 flex-shrink-0">
            <Pause size={15} fill="white" className="text-white"/>
          </button>
          <button onClick={() => navigate('pomodoro')}
            className="text-white/80 text-xs font-bold flex-shrink-0 px-1 active:text-white">
            Ver
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <PomodoroProvider>
        <AppInner />
      </PomodoroProvider>
    </AuthProvider>
  )
}
