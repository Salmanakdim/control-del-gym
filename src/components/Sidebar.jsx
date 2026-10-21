import { LayoutDashboard, Dumbbell, TrendingUp, Menu, X, BookOpen, LogOut, CheckSquare, CalendarDays, Flame, Timer, FileText, Wind, Moon, Scale, Sparkles, Target, Settings, ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePomodoro, fmtPomTime } from '../contexts/PomodoroContext'

const NAV = [
  { section: null },
  { id: 'dashboard',  label: 'Dashboard',      Icon: LayoutDashboard },
  { section: 'Productividad' },
  { id: 'tasks',      label: 'Tareas',          Icon: CheckSquare },
  { id: 'calendar',   label: 'Calendario',      Icon: CalendarDays },
  { id: 'pomodoro',   label: 'Pomodoro',        Icon: Timer },
  { id: 'notes',      label: 'Notas',           Icon: FileText },
  { section: 'Personal' },
  { id: 'afirmaciones',  label: 'Afirmaciones',   Icon: Sparkles },
  { id: 'revision',      label: 'Revisión diaria', Icon: ClipboardCheck },
  { id: 'habits',        label: 'Hábitos',        Icon: Flame },
  { id: 'metas',         label: 'Metas',          Icon: Target },
  { id: 'respiracion',   label: 'Meditación',     Icon: Wind },
  { section: 'Fitness' },
  { id: 'log',        label: 'Entrenamiento',   Icon: Dumbbell },
  { id: 'cuerpo',     label: 'Mi cuerpo',       Icon: Scale },
  { id: 'exercises',  label: 'Ejercicios',      Icon: BookOpen },
  { id: 'progress',   label: 'Progreso',        Icon: TrendingUp },
  { id: 'sueno',      label: 'Sueño',           Icon: Moon },
]

const MODE_COLORS = { work: '#2563eb', break: '#16a34a', longbreak: '#7c3aed' }

export default function Sidebar({ page, setPage }) {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const { pom } = usePomodoro()

  const navItems = (
    <nav className="flex flex-col gap-0.5 mt-4 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {NAV.map((item, i) => {
        if (item.section !== undefined && item.id === undefined) {
          return item.section ? (
            <p key={i} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-4 pb-1">
              {item.section}
            </p>
          ) : null
        }
        const isPom = item.id === 'pomodoro'
        return (
          <button
            key={item.id}
            onClick={() => { setPage(item.id); setOpen(false) }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left
              ${page === item.id
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <item.Icon size={17} />
            <span className="flex-1 text-left">{item.label}</span>
            {isPom && pom.running && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md text-white"
                style={{ background: MODE_COLORS[pom.mode] }}>
                {fmtPomTime(pom.secondsLeft)}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2.5 px-2 py-4 border-b border-slate-100">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Dumbbell size={16} className="text-white" />
        </div>
        <span className="font-black text-slate-800 text-xl tracking-tight">Flowlyday</span>
      </div>
      {navItems}
      <div className="border-t border-slate-100 pt-3 mt-2">
        <p className="text-xs text-slate-400 px-3 truncate mb-1">{user?.email}</p>
        <button
          onClick={() => { setPage('ajustes'); setOpen(false) }}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left mb-0.5
            ${page === 'ajustes' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <Settings size={17} />
          Ajustes
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full text-left"
        >
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-60 bg-white shadow-lg z-40 flex flex-col p-3
        transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:h-screen lg:flex
      `}>
        {sidebarContent}
      </aside>
    </>
  )
}
