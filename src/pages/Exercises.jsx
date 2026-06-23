import { useState, useMemo, useRef, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Search, X, Award, Calendar, Repeat, TrendingUp, BarChart3, Clock, Info,
  Dumbbell, ChevronRight, Filter, ArrowLeft,
} from 'lucide-react'
import { EXERCISES, MUSCLE_COLORS, DEFAULT_MUSCLE_COLOR } from '../store/gymStore'

function VideoThumb({ src, borderColor, onClick }) {
  const thumb = src.replace('/exercise_videos_395/', '/exercise_thumbnails/').replace('.mp4', '.jpg')
  return (
    <button onClick={onClick} className={`w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 bg-white border-2 ${borderColor} shadow-sm`}>
      <img src={thumb} alt="" className="w-full h-full object-contain" loading="lazy" />
    </button>
  )
}

function VideoModal({ exercise, onClose }) {
  const c = MUSCLE_COLORS[exercise.muscle] ?? DEFAULT_MUSCLE_COLOR
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <video
          src={`/exercise_videos_395/${exercise.video}`}
          autoPlay loop muted playsInline
          className="w-full bg-white object-contain"
          style={{ maxHeight: '300px' }}
        />
        <div className={`bg-gradient-to-br ${c.gradient} px-5 py-4 text-white`}>
          <p className="font-bold text-lg leading-tight">{exercise.name}</p>
          <p className="text-sm opacity-75 mt-0.5">{exercise.muscle}{exercise.equipment ? ` · ${exercise.equipment}` : ''}</p>
        </div>
        <button onClick={onClose} className="w-full py-3.5 text-slate-500 text-sm font-semibold hover:bg-slate-50 transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  )
}

const MUSCLE_FILTERS = ['Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Core', 'Pantorrillas', 'Trapecios', 'Antebrazos', 'Cardio']
const EQUIP_FILTERS  = ['Todo', 'Barra', 'Mancuerna', 'Cable', 'Máquina', 'Peso Corporal', 'Kettlebell', 'Smith', 'Banda', 'Suspensión']

function StatCard({ label, value, Icon, colorClass, bgClass }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm flex flex-col gap-2">
      <div className={`w-8 h-8 sm:w-9 sm:h-9 ${bgClass} rounded-lg flex items-center justify-center`}>
        <Icon size={15} className={colorClass} />
      </div>
      <div className="text-base sm:text-lg font-bold text-slate-800 leading-tight">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-36 sm:h-44 flex flex-col items-center justify-center text-slate-400 gap-2">
      <BarChart3 size={28} className="opacity-30" />
      <p className="text-sm text-center">Necesitas al menos 2 sesiones para ver la gráfica</p>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-sm">
      <div className="text-slate-500 mb-0.5">{label}</div>
      <div className="font-semibold text-blue-600">{payload[0].value} kg</div>
    </div>
  )
}

export default function Exercises({ logs }) {
  const [search, setSearch]             = useState('')
  const [muscleFilter, setMuscleFilter] = useState('Todos')
  const [equipFilter, setEquipFilter]   = useState('Todo')
  const [showEquipFilter, setShowEquipFilter] = useState(false)
  const [selected, setSelected]         = useState(EXERCISES[0])
  const [tab, setTab]                   = useState('stats')
  const [videoModal, setVideoModal]     = useState(null)
  // 'library' | 'detail' — controla qué panel se muestra en móvil
  const [mobilePanel, setMobilePanel]   = useState('library')

  const filtered = useMemo(() => EXERCISES.filter(ex => {
    const q = search.toLowerCase()
    return (
      (ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q)) &&
      (muscleFilter === 'Todos' || ex.muscle === muscleFilter) &&
      (equipFilter  === 'Todo'  || ex.equipment === equipFilter)
    )
  }), [search, muscleFilter, equipFilter])

  const exStats = useMemo(() => {
    if (!selected) return null
    const sessions = logs
      .filter(log => log.exercises.some(ex => ex.name === selected.name))
      .map(log => {
        const ex       = log.exercises.find(e => e.name === selected.name)
        const maxKg    = Math.max(...ex.sets.map(s => s.kg))
        const totalVol = ex.sets.reduce((a, s) => a + s.reps * s.kg, 0)
        return { date: log.date, maxKg, totalVol, sets: ex.sets }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
    const pr       = sessions.length ? Math.max(...sessions.map(s => s.maxKg)) : null
    const lastDate = sessions.length ? sessions[sessions.length - 1].date : null
    const totalVol = sessions.reduce((a, s) => a + s.totalVol, 0)
    return { sessions, pr, lastDate, totalSessions: sessions.length, totalVol }
  }, [selected, logs])

  const color = selected
    ? (MUSCLE_COLORS[selected.muscle] ?? DEFAULT_MUSCLE_COLOR)
    : DEFAULT_MUSCLE_COLOR

  function selectExercise(ex) {
    setSelected(ex)
    setTab('stats')
    setMobilePanel('detail')
  }

  // ── LIBRARY PANEL ───────────────────────────────────────────────────────────
  const libraryPanel = (
    <div className="bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden
                    lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-5rem)]">

      <div className="p-4 border-b border-slate-100 flex-shrink-0">
        <h2 className="font-bold text-slate-800 text-base mb-3">Biblioteca de Ejercicios</h2>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            className="w-full pl-8 pr-7 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl
                       focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Equipment filter toggle */}
        <button
          onClick={() => setShowEquipFilter(v => !v)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors mb-2 ${
            equipFilter !== 'Todo'
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          <Filter size={12} />
          {equipFilter === 'Todo' ? 'Equipamiento' : equipFilter}
        </button>

        {showEquipFilter && (
          <div className="flex flex-wrap gap-1 mb-2">
            {EQUIP_FILTERS.map(e => (
              <button
                key={e}
                onClick={() => { setEquipFilter(e); setShowEquipFilter(false) }}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  equipFilter === e
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Muscle chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {MUSCLE_FILTERS.map(m => (
            <button
              key={m}
              onClick={() => setMuscleFilter(m)}
              className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap flex-shrink-0 transition-colors font-medium ${
                muscleFilter === m
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise list */}
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">Sin resultados</div>
        ) : (
          filtered.map(ex => {
            const c          = MUSCLE_COLORS[ex.muscle] ?? DEFAULT_MUSCLE_COLOR
            const isSelected = selected?.id === ex.id
            return (
              <button
                key={ex.id}
                onClick={() => selectExercise(ex)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50
                            hover:bg-slate-50 active:bg-blue-50 transition-colors text-left
                            ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
              >
                <VideoThumb
                  src={`/exercise_videos_395/${ex.video}`}
                  borderColor={isSelected ? 'border-blue-400' : c.border}
                  onClick={e => { e.stopPropagation(); setVideoModal(ex) }}
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                    {ex.name}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{ex.muscle} · {ex.equipment}</div>
                </div>
                <ChevronRight size={14} className={isSelected ? 'text-blue-400' : 'text-slate-300'} />
              </button>
            )
          })
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-100 text-center text-xs text-slate-400 flex-shrink-0">
        {filtered.length} ejercicio{filtered.length !== 1 ? 's' : ''}
      </div>
    </div>
  )

  // ── DETAIL PANEL ────────────────────────────────────────────────────────────
  const detailPanel = selected ? (
    <div className="flex-1 flex flex-col gap-4 min-w-0">

      {/* Botón volver — solo móvil */}
      <button
        className="lg:hidden flex items-center gap-2 text-blue-600 font-medium text-sm py-1 self-start"
        onClick={() => setMobilePanel('library')}
      >
        <ArrowLeft size={16} />
        Biblioteca
      </button>

      {/* Video 3D */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex items-center justify-center" style={{ minHeight: '220px' }}>
        <video
          key={selected.id}
          src={`/exercise_videos_395/${selected.video}`}
          autoPlay
          loop
          muted
          playsInline
          className="w-full object-contain"
          style={{ maxHeight: '280px' }}
        />
      </div>

      {/* Header info */}
      <div className={`bg-gradient-to-br ${color.gradient} rounded-2xl p-4 sm:p-5 text-white shadow-lg`}>
        <div className="text-xs font-medium opacity-75 uppercase tracking-widest mb-1">{selected.equipment}</div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2 leading-tight">{selected.name}</h1>
        <div className="flex flex-wrap gap-1.5">
          <span className="bg-white/25 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {selected.muscle}
          </span>
          {selected.secondaryMuscles.map(m => (
            <span key={m} className="bg-white/12 text-white/85 text-xs px-2.5 py-1 rounded-full">{m}</span>
          ))}
        </div>
      </div>

      {/* Quick stats — 2 cols en móvil, 4 en desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          label="Récord personal"
          value={exStats?.pr != null ? `${exStats.pr} kg` : '—'}
          Icon={Award}
          colorClass="text-yellow-600"
          bgClass="bg-yellow-50"
        />
        <StatCard
          label="Sesiones"
          value={exStats?.totalSessions ?? 0}
          Icon={Repeat}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
        <StatCard
          label="Último entreno"
          value={exStats?.lastDate ? exStats.lastDate.slice(5).replace('-', '/') : '—'}
          Icon={Calendar}
          colorClass="text-green-600"
          bgClass="bg-green-50"
        />
        <StatCard
          label="Volumen total"
          value={exStats?.totalVol ? `${exStats.totalVol.toLocaleString()} kg` : '—'}
          Icon={TrendingUp}
          colorClass="text-purple-600"
          bgClass="bg-purple-50"
        />
      </div>

      {/* Tabs panel */}
      <div className="bg-white rounded-2xl shadow-sm">

        {/* Tab bar */}
        <div className="flex border-b border-slate-100 px-1 sm:px-2">
          {[
            { id: 'stats',   label: 'Estadísticas', short: 'Stats',    Icon: BarChart3 },
            { id: 'history', label: 'Historial',    short: 'Historial', Icon: Clock },
            { id: 'info',    label: 'Información',  short: 'Info',     Icon: Info },
          ].map(({ id, label, short, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3.5 text-xs sm:text-sm font-medium
                          border-b-2 transition-colors flex-1 justify-center ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4 sm:p-5">

          {/* ── STATS ── */}
          {tab === 'stats' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 text-sm sm:text-base">Progresión de peso</h3>
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">Máx. por sesión</span>
              </div>

              {(exStats?.sessions.length ?? 0) < 2 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={exStats.sessions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#cbd5e1" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#cbd5e1" unit=" kg" width={44} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="maxKg"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#fff', stroke: '#2563eb', strokeWidth: 2.5 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {(exStats?.sessions.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Última sesión · {exStats.sessions.at(-1).date}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {exStats.sessions.at(-1).sets.map((s, i) => (
                      <span key={i} className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-medium">
                        S{i + 1}: {s.reps} × {s.kg} kg
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY ── */}
          {tab === 'history' && (
            <div>
              {(exStats?.sessions.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3">
                  <Clock size={32} className="opacity-30" />
                  <p className="text-sm">Sin historial para este ejercicio</p>
                  <p className="text-xs">Registra un entrenamiento para empezar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...exStats.sessions].reverse().map((s, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3 sm:p-4
                                            hover:border-blue-200 transition-colors">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-slate-400" />
                          <span className="text-sm font-semibold text-slate-800">{s.date}</span>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                          Máx: {s.maxKg} kg
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.sets.map((set, j) => (
                          <div key={j} className="text-xs text-slate-600 bg-slate-50 border border-slate-200
                                                   rounded-lg px-2 py-1.5 font-medium">
                            {set.reps} × {set.kg} kg
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        Volumen: {s.totalVol.toLocaleString()} kg
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── INFO ── */}
          {tab === 'info' && (
            <div className="space-y-5">
              {selected.description ? (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Descripción</h3>
                  <p className="text-slate-700 text-sm leading-relaxed">{selected.description}</p>
                </div>
              ) : null}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Músculo Principal</h3>
                <span className={`inline-flex items-center gap-2 ${color.bg} ${color.text} px-3 py-1.5 rounded-lg text-sm font-semibold`}>
                  <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                  {selected.muscle}
                </span>
              </div>
              {selected.secondaryMuscles.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Músculos Secundarios</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.secondaryMuscles.map(m => (
                      <span key={m} className="bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-lg font-medium">{m}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.tips?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tips de Técnica</h3>
                  <ul className="space-y-2.5">
                    {selected.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <span className={`w-5 h-5 ${color.bg} ${color.text} rounded-full text-xs flex items-center
                                          justify-center font-bold flex-shrink-0 mt-0.5`}>
                          {i + 1}
                        </span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Equipamiento</h3>
                <span className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                  <Dumbbell size={14} className="text-slate-500" />
                  {selected.equipment}
                </span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  ) : (
    <div className="flex-1 bg-white rounded-2xl shadow-sm flex flex-col items-center justify-center text-slate-400 gap-3 min-h-64">
      <Dumbbell size={36} className="opacity-30" />
      <p className="text-sm">Selecciona un ejercicio</p>
    </div>
  )

  return (
    <>
      {videoModal && <VideoModal exercise={videoModal} onClose={() => setVideoModal(null)} />}

      {/* ── MÓVIL: un panel a la vez ── */}
      <div className="lg:hidden">
        {mobilePanel === 'library' ? libraryPanel : detailPanel}
      </div>

      {/* ── DESKTOP: dos paneles lado a lado ── */}
      <div className="hidden lg:flex gap-5 items-start">
        {libraryPanel}
        {detailPanel}
      </div>
    </>
  )
}
