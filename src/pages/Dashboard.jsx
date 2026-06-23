import { Calendar, Flame, Dumbbell, Clock, Trophy } from 'lucide-react'
import { totalVolume } from '../store/gymStore'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function MiniCalendar({ logs }) {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()

  const daysInMonth   = new Date(year, month + 1, 0).getDate()
  const firstWeekday  = new Date(year, month, 1).getDay()
  const monthStr      = `${year}-${String(month + 1).padStart(2, '0')}`

  const trainedDays = new Set(
    logs
      .filter(l => l.date.startsWith(monthStr))
      .map(l => parseInt(l.date.split('-')[2]))
  )

  const DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-700">{MONTHS[month]} {year}</h2>
        <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-lg">
          {trainedDays.size} días
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className="aspect-square flex items-center justify-center">
            {day && (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                day === today
                  ? trainedDays.has(day)
                    ? 'bg-blue-600 text-white'
                    : 'border-2 border-blue-600 text-blue-600'
                  : trainedDays.has(day)
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'text-slate-400'
              }`}>
                {day}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function calcStreak(logs) {
  const trainedSet = new Set(logs.map(l => l.date))
  const today = new Date()
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (trainedSet.has(key)) streak++
    else if (i > 0) break
  }
  return streak
}

export default function Dashboard({ logs, routines, setPage }) {
  const thisWeek = logs.filter(l => {
    const d = new Date(l.date)
    const now = new Date()
    return (now - d) / (1000 * 60 * 60 * 24) <= 7
  })

  const totalVol  = logs.reduce((acc, l) => acc + totalVolume(l.exercises), 0)
  const avgDuration = logs.length
    ? Math.round(logs.reduce((a, l) => a + (l.durationMin || 0), 0) / logs.length)
    : 0
  const streak = calcStreak(logs)

  const recent = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)

  const muscleCount = {}
  logs.forEach(l => l.exercises.forEach(ex => {
    muscleCount[ex.muscle] = (muscleCount[ex.muscle] || 0) + ex.sets.length
  }))
  const topMuscles = Object.entries(muscleCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxSets = topMuscles[0]?.[1] || 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen de tu entrenamiento</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Flame}    label="Esta semana"    value={`${thisWeek.length} sesiones`} color="bg-orange-500" />
        <StatCard icon={Calendar} label="Total entrenos" value={logs.length}                   color="bg-blue-600" />
        <StatCard icon={Dumbbell} label="Volumen total"  value={`${(totalVol/1000).toFixed(1)}t`} color="bg-violet-500" />
        <StatCard icon={Clock}    label="Media duración" value={`${avgDuration} min`}          color="bg-emerald-500" />
      </div>

      {/* Streak banner */}
      {streak > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 flex items-center gap-3 text-white">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="font-bold text-lg">{streak} {streak === 1 ? 'día' : 'días'} seguidos</p>
            <p className="text-orange-100 text-sm">¡Sigue así, no rompas la racha!</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <MiniCalendar logs={logs} />

        {/* Muscle distribution */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Músculos más trabajados</h2>
          {topMuscles.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Sin datos aún</p>
          ) : (
            <ul className="space-y-3">
              {topMuscles.map(([muscle, sets]) => (
                <li key={muscle}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{muscle}</span>
                    <span className="text-slate-400">{sets} series</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(sets / maxSets) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Últimas sesiones</h2>
        {recent.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">Sin sesiones registradas</p>
        ) : (
          <ul className="space-y-3">
            {recent.map(l => (
              <li key={l.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{l.routineName}</p>
                  <p className="text-xs text-slate-400">
                    {l.exercises.length} ejercicios · {l.exercises.reduce((a, e) => a + e.sets.length, 0)} series
                    {l.durationMin ? ` · ${l.durationMin} min` : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-400 ml-4 shrink-0">{l.date}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setPage('log')}
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl p-5 text-left transition-colors"
        >
          <Dumbbell size={24} className="mb-2" />
          <p className="font-semibold">Registrar entreno</p>
          <p className="text-blue-200 text-sm mt-1">Añade la sesión de hoy</p>
        </button>
        <button
          onClick={() => setPage('progress')}
          className="bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 rounded-2xl p-5 text-left shadow-sm transition-colors border border-slate-100"
        >
          <Trophy size={24} className="mb-2 text-yellow-500" />
          <p className="font-semibold">Ver récords</p>
          <p className="text-slate-400 text-sm mt-1">Tus mejores marcas</p>
        </button>
      </div>
    </div>
  )
}
