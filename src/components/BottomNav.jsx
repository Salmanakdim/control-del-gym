import { Home, CheckSquare, Flame, Moon, Dumbbell } from 'lucide-react'
import { usePomodoro, fmtPomTime } from '../contexts/PomodoroContext'

const MAIN = [
  { id:'dashboard', label:'Inicio',   Icon: Home },
  { id:'log',       label:'Entreno',  Icon: Dumbbell },
  { id:'habits',    label:'Hábitos',  Icon: Flame },
  { id:'tasks',     label:'Tareas',   Icon: CheckSquare },
  { id:'sueno',     label:'Sueño',    Icon: Moon },
]

const MODE_COLORS = { work:'#2563eb', break:'#16a34a', longbreak:'#7c3aed' }

export default function BottomNav({ page, setPage }) {
  const { pom } = usePomodoro()

  return (
    <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-30 bg-white rounded-3xl shadow-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center">
        {MAIN.map(({ id, label, Icon }) => {
          const active = page === id
          const isPom  = id === 'pomodoro'
          return (
            <button key={id} onClick={() => setPage(id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 active:bg-slate-50 transition-colors min-w-0 relative">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all
                ${active ? 'bg-blue-600' : ''}`}>
                <Icon size={18} className={active ? 'text-white' : 'text-slate-400'}/>
              </div>
              <p className={`text-[10px] font-bold ${active ? 'text-blue-600' : 'text-slate-400'}`}>{label}</p>
              {isPom && pom.running && (
                <div className="absolute top-1 right-2 px-1.5 py-0.5 rounded-full text-white text-[9px] font-black"
                  style={{ background: MODE_COLORS[pom.mode] }}>
                  {fmtPomTime(pom.secondsLeft)}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
