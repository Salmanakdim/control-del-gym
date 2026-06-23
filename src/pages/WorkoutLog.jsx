import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Plus, Trash2, Check, Clock, ArrowLeft, Dumbbell, MoreVertical, Timer, Trophy, Search, X, ChevronRight } from 'lucide-react'
import { uid, EXERCISES, MUSCLE_COLORS, DEFAULT_MUSCLE_COLOR } from '../store/gymStore'

const PICKER_MUSCLES = ['Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Core', 'Pantorrillas', 'Trapecios', 'Antebrazos', 'Cardio']

function PausedVideoThumb({ src, borderColor, onClick }) {
  if (!src) return (
    <button onClick={onClick} className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border-2 ${borderColor} flex items-center justify-center`}>
      <Dumbbell size={20} className="text-slate-400" />
    </button>
  )
  const thumb = src.replace('/exercise_videos_395/', '/exercise_thumbnails/').replace('.mp4', '.jpg')
  return (
    <button onClick={onClick} className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white border-2 ${borderColor} shadow-sm`}>
      <img src={thumb} alt="" className="w-full h-full object-contain" />
    </button>
  )
}

function VideoModal({ exercise, onClose }) {
  const c = MUSCLE_COLORS[exercise.muscle] ?? DEFAULT_MUSCLE_COLOR
  const src = exercise.video ? `/exercise_videos_395/${exercise.video}` : null
  if (!src) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <video
          src={src} autoPlay loop muted playsInline
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

function VideoThumbPicker({ src, borderColor, onClick }) {
  const thumb = src.replace('/exercise_videos_395/', '/exercise_thumbnails/').replace('.mp4', '.jpg')
  return (
    <button onClick={onClick} className={`w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 bg-white border-2 ${borderColor} shadow-sm`}>
      <img src={thumb} alt="" className="w-full h-full object-contain" loading="lazy" />
    </button>
  )
}

function ExercisePicker({ onSelect, onClose }) {
  const [search, setSearch]     = useState('')
  const [muscle, setMuscle]     = useState('Todos')
  const [previewEx, setPreviewEx] = useState(null)

  const filtered = useMemo(() => EXERCISES.filter(ex => {
    const q = search.toLowerCase()
    return (
      (ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q)) &&
      (muscle === 'Todos' || ex.muscle === muscle)
    )
  }), [search, muscle])

  return (
    <>
      {previewEx && <VideoModal exercise={previewEx} onClose={() => setPreviewEx(null)} />}
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div
        className="mt-auto bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: '92dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800 text-lg">Agregar ejercicio</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ejercicio..."
              className="w-full pl-9 pr-8 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl
                         focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Muscle chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {PICKER_MUSCLES.map(m => (
              <button
                key={m}
                onClick={() => setMuscle(m)}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 font-medium transition-colors ${
                  muscle === m
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="px-4 py-1.5 border-t border-slate-100 text-xs text-slate-400 flex-shrink-0">
          {filtered.length} ejercicio{filtered.length !== 1 ? 's' : ''}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Sin resultados</div>
          ) : (
            filtered.map(ex => {
              const c = MUSCLE_COLORS[ex.muscle] ?? DEFAULT_MUSCLE_COLOR
              return (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50
                             hover:bg-blue-50 active:bg-blue-100 transition-colors text-left"
                >
                  <VideoThumbPicker
                    src={`/exercise_videos_395/${ex.video}`}
                    borderColor={c.border}
                    onClick={e => { e.stopPropagation(); setPreviewEx(ex) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{ex.name}</div>
                    <div className="text-xs text-slate-400">{ex.muscle} · {ex.equipment}</div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
    </>
  )
}

// ── PR Toast ───────────────────────────────────────────────────────────────────
function PRToast({ toast }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null

  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
    }`}>
      <div className="bg-slate-800 rounded-2xl shadow-2xl flex items-center gap-3 px-4 py-3 min-w-64 max-w-xs">
        <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <Dumbbell size={18} className="text-slate-300" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{toast.name}</p>
          <p className="text-yellow-400 text-sm font-bold">Mayor Peso · {toast.kg} kg 🏆</p>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_REST = 120

function fmtTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtRest(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}min ${s}s` : `${s}s`
}

function getPrevSets(logs, name) {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  for (const log of sorted) {
    const ex = log.exercises.find(e => e.name === name)
    if (ex) return ex.sets
  }
  return null
}

function getPR(logs, name) {
  let best = 0
  logs.forEach(log => {
    const ex = log.exercises.find(e => e.name === name)
    if (ex) ex.sets.forEach(s => { if ((parseFloat(s.kg) || 0) > best) best = parseFloat(s.kg) })
  })
  return best
}

// ── Set Row ────────────────────────────────────────────────────────────────────
function SetRow({ set, label, isWarmup, prevSet, done, rowIndex, isPR, onChange, onRemove, onToggle }) {
  const [offset, setOffset]     = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX  = useRef(0)
  const startY  = useRef(0)
  const horiz   = useRef(false)
  const THRESHOLD = -72

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    horiz.current  = false
  }
  function onTouchMove(e) {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!horiz.current && Math.abs(dy) > Math.abs(dx)) return
    if (!horiz.current) { horiz.current = true; setDragging(true) }
    if (dx < 0) setOffset(Math.max(dx, -90))
    else setOffset(0)
  }
  function onTouchEnd() {
    setDragging(false); horiz.current = false
    if (offset <= THRESHOLD) { setOffset(-400); setTimeout(onRemove, 180) }
    else setOffset(0)
  }

  const rowStyle = isPR
    ? 'bg-yellow-50'
    : done
      ? 'bg-green-50'
      : isWarmup
        ? 'bg-amber-50'
        : rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-100'

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 w-20 bg-red-400 flex items-center justify-center">
        <Trash2 size={15} className="text-white" />
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 0.22s ease' }}
        className={`relative z-10 grid grid-cols-[40px_1fr_76px_76px_44px] items-center px-4 py-3 border-b border-white ${rowStyle}`}
      >
        {/* SERIE */}
        <div className="flex flex-col items-center justify-center gap-0.5">
          <span className={`text-sm font-bold ${
            isPR ? 'text-yellow-600' : isWarmup ? 'text-amber-500' : done ? 'text-green-600' : 'text-slate-500'
          }`}>{label}</span>
          {isPR && <Trophy size={10} className="text-yellow-500" />}
        </div>

        {/* ANTERIOR */}
        <div className="text-xs text-slate-400 text-center leading-tight">
          {prevSet ? `${prevSet.kg}kg x ${prevSet.reps}` : '—'}
        </div>

        {/* KG */}
        <div className="flex justify-center">
          <input
            type="text" value={set.kg || ''}
            onChange={e => onChange({ ...set, kg: e.target.value })}
            onBlur={e => onChange({ ...set, kg: parseFloat(e.target.value) || 0 })}
            className={`w-full text-center text-sm font-bold bg-transparent border-none outline-none p-0 ${
              done ? 'text-green-700' : 'text-slate-800'
            }`}
            placeholder="—"
            inputMode="decimal"
          />
        </div>

        {/* REPS */}
        <div className="flex justify-center">
          <input
            type="text" value={set.reps || ''}
            onChange={e => onChange({ ...set, reps: e.target.value })}
            onBlur={e => onChange({ ...set, reps: parseInt(e.target.value) || 0 })}
            className={`w-full text-center text-sm font-bold bg-transparent border-none outline-none p-0 ${
              done ? 'text-green-700' : 'text-slate-800'
            }`}
            placeholder="—"
            inputMode="numeric"
          />
        </div>

        {/* CHECK */}
        <div className="flex justify-center">
          <button
            onClick={onToggle}
            className={`w-8 h-8 flex items-center justify-center transition-all rounded-xl ${
              done
                ? 'bg-green-500 shadow-sm'
                : 'border-2 border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            {done && <Check size={14} className="text-white" strokeWidth={3} />}
          </button>
        </div>
      </div>
    </div>
  )
}

const REST_PRESETS = [
  { label: '30s', secs: 30 },
  { label: '1min', secs: 60 },
  { label: '1:30', secs: 90 },
  { label: '2min', secs: 120 },
  { label: '3min', secs: 180 },
  { label: '5min', secs: 300 },
]

// ── Exercise Card ──────────────────────────────────────────────────────────────
function ExerciseCard({ ex, ei, doneSets, prSets, note, logs, onUpdateSet, onRemoveSet, onAddSet, onAddWarmup, onToggle, onNoteChange, onRemove, onNameChange, onMuscleChange, onRestChange }) {
  const [showMenu, setShowMenu]   = useState(false)
  const [showRest, setShowRest]   = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const prevSets = getPrevSets(logs, ex.name)
  const c = MUSCLE_COLORS[ex.muscle] ?? DEFAULT_MUSCLE_COLOR
  let normalIdx  = 0

  return (
    <div className="bg-white mb-3 border-b border-slate-100">

      {showVideo && <VideoModal exercise={ex} onClose={() => setShowVideo(false)} />}

      {/* Exercise header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <PausedVideoThumb
          src={ex.video ? `/exercise_videos_395/${ex.video}` : null}
          borderColor={c.border}
          onClick={() => ex.video && setShowVideo(true)}
        />
        <div className="flex-1 min-w-0 pt-0.5">
          <input
            value={ex.name}
            onChange={e => onNameChange(ei, e.target.value)}
            className="text-blue-600 font-semibold text-base w-full bg-transparent border-none outline-none leading-tight"
            placeholder="Nombre del ejercicio"
          />
          <input
            value={ex.muscle}
            onChange={e => onMuscleChange(ei, e.target.value)}
            className="text-xs text-slate-400 w-full bg-transparent border-none outline-none mt-0.5"
            placeholder="Músculo"
          />
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(m => !m)}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <MoreVertical size={18} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-36">
              <button
                onClick={() => { onAddWarmup(ei); setShowMenu(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                + Serie calentamiento
              </button>
              <button
                onClick={() => { onRemove(ei); setShowMenu(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
              >
                Eliminar ejercicio
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="px-4 pb-2">
        <input
          value={note || ''}
          onChange={e => onNoteChange(ei, e.target.value)}
          placeholder="Agregar notas aquí..."
          className="w-full text-sm text-slate-400 placeholder:text-slate-300 bg-transparent border-none outline-none"
        />
      </div>

      {/* Rest indicator — tappable */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setShowRest(v => !v)}
          className="flex items-center gap-2 active:opacity-70"
        >
          <div className="w-5 h-5 rounded-full border-2 border-blue-400 flex items-center justify-center flex-shrink-0">
            <Timer size={10} className="text-blue-500" />
          </div>
          <span className="text-sm text-blue-500 font-medium">
            Descanso: {fmtRest(ex.restSecs ?? DEFAULT_REST)}
          </span>
          <span className="text-xs text-blue-400">{showRest ? '▲' : '▼'}</span>
        </button>

        {showRest && (
          <div className="mt-3 bg-slate-50 rounded-2xl p-3 space-y-3">
            {/* Presets */}
            <div className="flex gap-2 flex-wrap">
              {REST_PRESETS.map(p => (
                <button
                  key={p.secs}
                  onClick={() => onRestChange(ei, p.secs)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    (ex.restSecs ?? DEFAULT_REST) === p.secs
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">Personalizar:</span>
              <input
                type="text"
                value={Math.floor((ex.restSecs ?? DEFAULT_REST) / 60)}
                onChange={e => onRestChange(ei, (parseInt(e.target.value) || 0) * 60 + ((ex.restSecs ?? DEFAULT_REST) % 60))}
                className="w-10 text-center border border-slate-200 rounded-lg py-1 text-sm font-bold bg-white outline-none focus:border-blue-400"
                inputMode="numeric"
              />
              <span className="text-sm text-slate-500">min</span>
              <input
                type="text"
                value={(ex.restSecs ?? DEFAULT_REST) % 60}
                onChange={e => onRestChange(ei, Math.floor((ex.restSecs ?? DEFAULT_REST) / 60) * 60 + (parseInt(e.target.value) || 0))}
                className="w-10 text-center border border-slate-200 rounded-lg py-1 text-sm font-bold bg-white outline-none focus:border-blue-400"
                inputMode="numeric"
              />
              <span className="text-sm text-slate-500">seg</span>
            </div>
          </div>
        )}
      </div>

      {/* Column headers — same grid as SetRow */}
      <div className="grid grid-cols-[40px_1fr_76px_76px_44px] items-center px-4 py-2 border-t border-b border-slate-200 bg-slate-50">
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Serie</div>
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anterior</div>
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">KG</div>
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reps</div>
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">✓</div>
      </div>

      {/* Sets */}
      {ex.sets.map((set, si) => {
        const isWarmup = !!set.warmup
        const label    = isWarmup ? 'W' : ++normalIdx
        const prevSet  = prevSets?.[isWarmup ? 0 : si]
        return (
          <SetRow
            key={set.id}
            set={set}
            label={label}
            isWarmup={isWarmup}
            prevSet={prevSet}
            done={!!doneSets[`${ei}-${si}`]}
            isPR={!!prSets[`${ei}-${si}`]}
            rowIndex={si}
            onChange={s => onUpdateSet(ei, si, s)}
            onRemove={() => onRemoveSet(ei, si)}
            onToggle={() => onToggle(ei, si)}
          />
        )
      })}

      {/* Add set */}
      <button
        onClick={() => onAddSet(ei)}
        className="w-full py-3.5 flex items-center justify-center gap-2 text-slate-500 text-sm font-semibold bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors"
      >
        <Plus size={16} /> Agregar Serie
      </button>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function WorkoutLog({ routines, logs, setLogs, setPage }) {
  const [phase, setPhase]             = useState('select')
  const [workoutName, setWorkoutName] = useState('Entreno')
  const [selectedRoutineId, setSelectedRoutineId] = useState(null)
  const [exercises, setExercises]     = useState([])
  const [doneSets, setDoneSets]       = useState({})
  const [prSets, setPrSets]           = useState({})
  const [newPRs, setNewPRs]           = useState([])
  const [prToast, setPrToast]         = useState(null)
  const [summaryLog, setSummaryLog]   = useState(null)
  const [notes, setNotes]             = useState({})

  const [showPicker, setShowPicker]   = useState(false)

  const [elapsed, setElapsed]         = useState(0)
  const elapsedRef                    = useRef(0)
  const timerRef                      = useRef(null)

  const [restActive, setRestActive]         = useState(false)
  const [restRemaining, setRestRemaining]   = useState(0)

  useEffect(() => {
    if (phase !== 'active') return
    timerRef.current = setInterval(() => { elapsedRef.current += 1; setElapsed(elapsedRef.current) }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  useEffect(() => {
    if (!restActive || restRemaining <= 0) { if (restRemaining <= 0) setRestActive(false); return }
    const t = setTimeout(() => setRestRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [restActive, restRemaining])

  function startWorkout(routine) {
    if (routine) {
      setSelectedRoutineId(routine.id)
      setWorkoutName(routine.name)
      setExercises(routine.exercises.map(ex => ({
        ...ex, id: uid(), restSecs: DEFAULT_REST,
        sets: ex.sets.map(s => ({ ...s, id: uid() })),
      })))
    } else {
      setSelectedRoutineId(null)
      setWorkoutName('Entreno libre')
      setExercises([])
    }
    setDoneSets({}); setPrSets({}); setNewPRs([]); setNotes({})
    elapsedRef.current = 0; setElapsed(0)
    setPhase('active')
  }

  const updateSet     = (ei, si, s) => setExercises(exs => { const n=[...exs]; const sets=[...n[ei].sets]; sets[si]=s; n[ei]={...n[ei],sets}; return n })
  const removeSet     = (ei, si)    => setExercises(exs => { const n=[...exs]; n[ei]={...n[ei],sets:n[ei].sets.filter((_,i)=>i!==si)}; return n })
  const addSet        = (ei)        => setExercises(exs => { const n=[...exs]; const last=n[ei].sets.filter(s=>!s.warmup).at(-1)||{reps:10,kg:0}; n[ei]={...n[ei],sets:[...n[ei].sets,{...last,id:uid(),warmup:false}]}; return n })
  const addWarmup     = (ei)        => setExercises(exs => { const n=[...exs]; n[ei]={...n[ei],sets:[{id:uid(),warmup:true,kg:0,reps:15},...n[ei].sets.filter(s=>!s.warmup)]}; return n })
  const removeExercise = (ei)       => setExercises(exs => exs.filter((_,i)=>i!==ei))
  const addExercise    = ()         => setShowPicker(true)
  const addExerciseFromPicker = (ex) => {
    setExercises(exs => [...exs, { id: uid(), name: ex.name, muscle: ex.muscle, equipment: ex.equipment, video: ex.video, restSecs: DEFAULT_REST, sets: [{ id: uid(), reps: 10, kg: 0 }] }])
    setShowPicker(false)
  }
  const setName        = (ei,v)     => setExercises(exs => { const n=[...exs]; n[ei]={...n[ei],name:v}; return n })
  const setMuscle      = (ei,v)     => setExercises(exs => { const n=[...exs]; n[ei]={...n[ei],muscle:v}; return n })
  const setRestSecs    = (ei,v)     => setExercises(exs => { const n=[...exs]; n[ei]={...n[ei],restSecs:v}; return n })

  const toggleSet = (ei, si) => {
    const key = `${ei}-${si}`
    setDoneSets(d => {
      const completing = !d[key]
      if (completing) {
        const ex  = exercises[ei]
        const set = ex.sets[si]
        const kg  = parseFloat(set.kg) || 0
        const best = getPR(logs, ex.name)
        if (kg > 0 && kg > best) {
          setPrSets(ps => ({ ...ps, [key]: true }))
          setPrToast({ name: ex.name, kg })
          setNewPRs(prs => {
            const idx = prs.findIndex(p => p.name === ex.name)
            if (idx === -1) return [...prs, { name: ex.name, kg }]
            const upd = [...prs]; if (kg > upd[idx].kg) upd[idx] = { name: ex.name, kg }
            return upd
          })
        }
        setRestRemaining(ex.restSecs ?? DEFAULT_REST)
        setRestActive(true)
      } else {
        setPrSets(ps => { const n = { ...ps }; delete n[key]; return n })
      }
      return { ...d, [key]: completing }
    })
  }

  const totalSets     = exercises.reduce((a, e) => a + e.sets.length, 0)
  const completedSets = Object.values(doneSets).filter(Boolean).length
  const volume        = exercises.reduce((acc,ex,ei) =>
    acc + ex.sets.reduce((a,s,si) => doneSets[`${ei}-${si}`] ? a+s.kg*s.reps : a, 0), 0)

  const handleFinish = () => {
    clearInterval(timerRef.current)
    setRestActive(false)
    const log = {
      id: uid(),
      date: new Date().toISOString().split('T')[0],
      routineId: selectedRoutineId || null,
      routineName: workoutName,
      durationMin: Math.max(1, Math.round(elapsed / 60)),
      exercises: exercises.filter(ex => ex.name).map(ex => ({
        name: ex.name, muscle: ex.muscle,
        sets: ex.sets.filter(s => !s.warmup),
      })),
    }
    if (log.exercises.length > 0) setLogs(ls => [log, ...ls])
    setSummaryLog(log)
    setPhase('summary')
  }

  const cancelWorkout = () => {
    if (exercises.length === 0 || window.confirm('¿Salir sin guardar?')) {
      clearInterval(timerRef.current); setPhase('select')
    }
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  if (phase === 'summary') {
    const totalCompletedSets = summaryLog?.exercises.reduce((a, e) => a + e.sets.length, 0) || 0
    const totalVol = summaryLog?.exercises.reduce((a, ex) =>
      a + ex.sets.reduce((b, s) => b + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0), 0) || 0

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 max-w-sm mx-auto text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center mb-5 shadow-lg">
          <Trophy size={44} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">¡Entreno completado!</h1>
        <p className="text-slate-400 text-sm mb-6">{summaryLog?.routineName} · {summaryLog?.date}</p>

        {/* Stats */}
        <div className="w-full bg-white rounded-2xl shadow-sm p-4 mb-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Duración', value: `${summaryLog?.durationMin || 0} min` },
            { label: 'Volumen', value: `${totalVol.toLocaleString()} kg` },
            { label: 'Series', value: totalCompletedSets },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-lg font-bold text-blue-600">{value}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* PRs */}
        {newPRs.length > 0 && (
          <div className="w-full bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={16} className="text-yellow-500" />
              <span className="font-bold text-slate-700 text-sm">Récords personales batidos</span>
            </div>
            {newPRs.map(pr => (
              <div key={pr.name} className="flex justify-between items-center py-1.5 border-b border-yellow-100 last:border-0">
                <span className="text-sm text-slate-600">{pr.name}</span>
                <span className="text-sm font-bold text-yellow-600">{pr.kg} kg 🏆</span>
              </div>
            ))}
          </div>
        )}

        {/* Exercises */}
        <div className="w-full bg-white rounded-2xl shadow-sm p-4 mb-6 text-left">
          {summaryLog?.exercises.map((ex, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
              <span className="text-sm font-medium text-slate-700">{ex.name}</span>
              <span className="text-xs text-slate-400">{ex.sets.length} series</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setPage('dashboard')}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-base active:bg-blue-800"
        >
          Ir al Dashboard
        </button>
        <button
          onClick={() => setPhase('select')}
          className="w-full mt-3 py-3 text-slate-400 text-sm"
        >
          Nuevo entrenamiento
        </button>
      </div>
    )
  }

  // ── SELECT ───────────────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="space-y-5 max-w-lg">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Entrenamiento</h1>
          <p className="text-slate-500 text-sm mt-1">Elige cómo empezar</p>
        </div>

        <button
          onClick={() => startWorkout(null)}
          className="w-full flex items-center gap-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl px-5 py-4 text-slate-600 hover:border-blue-400 hover:text-blue-600 active:bg-blue-50 transition-colors"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Plus size={20} className="text-blue-600" />
          </div>
          <span className="font-semibold">Empezar Entrenamiento Vacío</span>
        </button>

        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
            Mis Rutinas ({routines.length})
          </h2>
          <div className="space-y-3">
            {routines.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-slate-400 text-sm">
                No tienes rutinas. Créalas en la sección Rutinas.
              </div>
            )}
            {routines.map(r => (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100">
                <div className="mb-3">
                  <div className="font-semibold text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {r.exercises.map(e => e.name).join(', ')}
                  </div>
                </div>
                <button
                  onClick={() => startWorkout(r)}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl py-3 font-bold text-sm transition-colors"
                >
                  Empezar Rutina
                </button>
              </div>
            ))}
          </div>
        </div>

        {logs.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              Últimas Sesiones
            </h2>
            <div className="space-y-3">
              {[...logs].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5).map(log => (
                <div key={log.id} className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800 text-sm">{log.routineName}</span>
                    <span className="text-xs text-slate-400">{log.date}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {log.exercises.map((ex,i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">{ex.name}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {log.durationMin > 0 && <span>⏱ {log.durationMin} min</span>}
                    <span>💪 {log.exercises.length} ejercicios</span>
                    <span>📋 {log.exercises.reduce((a,e) => a+e.sets.length, 0)} series</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── ACTIVE ───────────────────────────────────────────────────────────────────
  return (
    <div className="pb-28 -mx-4 sm:-mx-8">

      {showPicker && <ExercisePicker onSelect={addExerciseFromPicker} onClose={() => setShowPicker(false)} />}

      <PRToast toast={prToast} />

      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-100 sticky top-0 z-20">
        <button onClick={cancelWorkout} className="text-slate-500 p-1">
          <ArrowLeft size={20} />
        </button>
        <span className="flex-1 font-bold text-slate-800 text-base truncate">{workoutName}</span>
        <div className="flex items-center gap-1.5 text-slate-400 mr-2">
          <Clock size={16} />
          <span className="font-mono text-sm font-semibold text-slate-600">{fmtTime(elapsed)}</span>
        </div>
        <button
          onClick={handleFinish}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm active:bg-blue-800"
        >
          Terminar
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center px-4 py-3 bg-white border-b border-slate-100 gap-6">
        <div>
          <div className="text-xs text-slate-400">Duración</div>
          <div className="text-blue-600 font-bold text-sm">{fmtTime(elapsed)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Volumen</div>
          <div className="text-blue-600 font-bold text-sm">{volume.toLocaleString()} kg</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Series</div>
          <div className="text-blue-600 font-bold text-sm">{completedSets}</div>
        </div>
        <div className="flex-1" />
        {/* Muscle silhouettes placeholder */}
        <div className="flex gap-1 opacity-30">
          <Dumbbell size={28} className="text-slate-600" />
        </div>
      </div>

      {/* Exercise cards */}
      <div className="mt-3">
        {exercises.map((ex, ei) => (
          <ExerciseCard
            key={ex.id}
            ex={ex} ei={ei}
            doneSets={doneSets}
            prSets={prSets}
            note={notes[ei]}
            logs={logs}
            onUpdateSet={updateSet}
            onRemoveSet={removeSet}
            onAddSet={addSet}
            onAddWarmup={addWarmup}
            onToggle={toggleSet}
            onNoteChange={(i,v) => setNotes(n => ({...n,[i]:v}))}
            onRemove={removeExercise}
            onNameChange={setName}
            onMuscleChange={setMuscle}
            onRestChange={setRestSecs}
          />
        ))}

        <div className="px-4 mt-2 pb-4">
          <button
            onClick={addExercise}
            className="w-full flex items-center gap-2 justify-center border-2 border-dashed border-slate-200 rounded-2xl py-4 text-slate-400 hover:border-blue-400 hover:text-blue-500 active:bg-blue-50 transition-colors"
          >
            <Plus size={16} /> Añadir ejercicio
          </button>

          <button
            onClick={handleFinish}
            className="w-full mt-3 py-4 bg-blue-600 text-white rounded-2xl font-bold text-base active:bg-blue-800"
          >
            Terminar entrenamiento
          </button>
        </div>
      </div>

      {/* ── Rest timer — fixed bottom ── */}
      {restActive && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 text-white shadow-2xl">
          <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setRestRemaining(r => Math.max(0, r - 15))}
              className="bg-slate-700 rounded-xl w-14 h-12 font-bold text-sm flex-shrink-0"
            >
              -15
            </button>
            <div className="flex-1 text-center">
              <div className="text-xs text-slate-400 leading-none mb-0.5">Descanso</div>
              <div className="text-4xl font-mono font-bold">{fmtTime(restRemaining)}</div>
            </div>
            <button
              onClick={() => setRestRemaining(r => r + 15)}
              className="bg-slate-700 rounded-xl w-14 h-12 font-bold text-sm flex-shrink-0"
            >
              +15
            </button>
            <button
              onClick={() => { setRestActive(false); setRestRemaining(0) }}
              className="bg-blue-600 rounded-xl px-4 h-12 font-bold text-sm flex-shrink-0"
            >
              Omitir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
