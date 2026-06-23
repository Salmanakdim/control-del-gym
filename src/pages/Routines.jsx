import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Edit2, X, GripVertical, Search, ChevronRight, Check, Timer, MoreVertical } from 'lucide-react'
import { uid, EXERCISES, MUSCLE_COLORS, DEFAULT_MUSCLE_COLOR } from '../store/gymStore'

const DEFAULT_REST = 120
const PICKER_MUSCLES = ['Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Core', 'Pantorrillas', 'Trapecios', 'Antebrazos', 'Cardio']
const REST_PRESETS = [
  { label: '30s', secs: 30 }, { label: '1min', secs: 60 }, { label: '1:30', secs: 90 },
  { label: '2min', secs: 120 }, { label: '3min', secs: 180 }, { label: '5min', secs: 300 },
]

function fmtRest(secs) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}min ${s}s`
}

// ── Video Thumb (animated, for picker list) ────────────────────────────────
function VideoThumb({ src, borderColor, onClick }) {
  const thumb = src.replace('/exercise_videos_395/', '/exercise_thumbnails/').replace('.mp4', '.jpg')
  return (
    <button onClick={onClick} className={`w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 bg-white border-2 ${borderColor} shadow-sm`}>
      <img src={thumb} alt="" className="w-full h-full object-contain" loading="lazy" />
    </button>
  )
}

// ── Paused Video Thumb (first frame, clickable) ────────────────────────────
function PausedVideoThumb({ src, borderColor, onClick }) {
  if (!src) return (
    <button onClick={onClick} className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border-2 ${borderColor} flex items-center justify-center`}>
      <span className="text-xl">💪</span>
    </button>
  )
  const thumb = src.replace('/exercise_videos_395/', '/exercise_thumbnails/').replace('.mp4', '.jpg')
  return (
    <button onClick={onClick} className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white border-2 ${borderColor} shadow-sm`}>
      <img src={thumb} alt="" className="w-full h-full object-contain" />
    </button>
  )
}

// ── Video Modal ────────────────────────────────────────────────────────────
function VideoModal({ exercise, onClose }) {
  const c = MUSCLE_COLORS[exercise.muscle] ?? DEFAULT_MUSCLE_COLOR
  const src = exercise.video ? `/exercise_videos_395/${exercise.video}` : null
  if (!src) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <video src={src} autoPlay loop muted playsInline className="w-full bg-white object-contain" style={{ maxHeight: '300px' }} />
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

// ── Exercise Picker (bottom sheet) ─────────────────────────────────────────
function ExercisePicker({ onSelect, onClose }) {
  const [search, setSearch]   = useState('')
  const [muscle, setMuscle]   = useState('Todos')
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
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="mt-auto bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '92dvh' }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800 text-lg">Agregar ejercicio</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ejercicio..."
              className="w-full pl-9 pr-8 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {PICKER_MUSCLES.map(m => (
              <button key={m} onClick={() => setMuscle(m)}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 font-medium transition-colors ${
                  muscle === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="px-4 py-1.5 border-t border-slate-100 text-xs text-slate-400 flex-shrink-0">
          {filtered.length} ejercicio{filtered.length !== 1 ? 's' : ''}
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Sin resultados</div>
          ) : filtered.map(ex => {
            const c = MUSCLE_COLORS[ex.muscle] ?? DEFAULT_MUSCLE_COLOR
            return (
              <button key={ex.id} onClick={() => onSelect(ex)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50 hover:bg-blue-50 active:bg-blue-100 transition-colors text-left">
                <VideoThumb
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
          })}
        </div>
      </div>
    </div>
    </>
  )
}

// ── Set Row ────────────────────────────────────────────────────────────────
function SetRow({ set, idx, onChange, onRemove }) {
  const [offset, setOffset]   = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const horiz  = useRef(false)
  const THRESHOLD = -72

  function onTouchStart(e) { startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY; horiz.current = false }
  function onTouchMove(e) {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!horiz.current && Math.abs(dy) > Math.abs(dx)) return
    if (!horiz.current) { horiz.current = true; setDragging(true) }
    if (dx < 0) setOffset(Math.max(dx, -90)); else setOffset(0)
  }
  function onTouchEnd() {
    setDragging(false); horiz.current = false
    if (offset <= THRESHOLD) { setOffset(-400); setTimeout(onRemove, 180) } else setOffset(0)
  }

  const bg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-100'

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 w-20 bg-red-400 flex items-center justify-center">
        <Trash2 size={15} className="text-white" />
      </div>
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 0.22s ease' }}
        className={`relative z-10 grid grid-cols-[40px_1fr_1fr_1fr] items-center px-4 py-3 border-b border-white ${bg}`}
      >
        {/* SERIE */}
        <div className="flex justify-center">
          <span className="text-sm font-bold text-slate-500">{idx + 1}</span>
        </div>

        {/* ANTERIOR */}
        <div className="text-xs text-slate-400 text-center leading-tight">—</div>

        {/* KG */}
        <div className="flex justify-center">
          <input
            type="text" value={set.kg || ''}
            onChange={e => onChange({ ...set, kg: e.target.value })}
            onBlur={e => onChange({ ...set, kg: parseFloat(e.target.value) || 0 })}
            className="w-full text-center text-sm font-bold text-slate-800 bg-transparent border-none outline-none p-0"
            placeholder="—" inputMode="decimal"
          />
        </div>

        {/* REPS */}
        <div className="flex justify-center">
          <input
            type="text" value={set.reps || ''}
            onChange={e => onChange({ ...set, reps: e.target.value })}
            onBlur={e => onChange({ ...set, reps: parseInt(e.target.value) || 0 })}
            className="w-full text-center text-sm font-bold text-slate-800 bg-transparent border-none outline-none p-0"
            placeholder="—" inputMode="numeric"
          />
        </div>

      </div>
    </div>
  )
}

// ── Exercise Card ──────────────────────────────────────────────────────────
function ExerciseCard({ exercise, onChange, onRemove }) {
  const [open, setOpen]         = useState(true)
  const [showRest, setShowRest] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const c = MUSCLE_COLORS[exercise.muscle] ?? DEFAULT_MUSCLE_COLOR

  const updateSet = (i, set) => { const sets = [...exercise.sets]; sets[i] = set; onChange({ ...exercise, sets }) }
  const removeSet = (i) => onChange({ ...exercise, sets: exercise.sets.filter((_, idx) => idx !== i) })
  const addSet = () => {
    const last = exercise.sets[exercise.sets.length - 1] || { reps: 10, kg: 0 }
    onChange({ ...exercise, sets: [...exercise.sets, { ...last }] })
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden mb-3">

      {showVideo && <VideoModal exercise={exercise} onClose={() => setShowVideo(false)} />}

      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <PausedVideoThumb
          src={exercise.video ? `/exercise_videos_395/${exercise.video}` : null}
          borderColor={c.border}
          onClick={() => exercise.video && setShowVideo(true)}
        />
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-blue-600 font-semibold text-base leading-tight truncate">{exercise.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{exercise.muscle}</p>
        </div>
        <div className="relative flex-shrink-0">
          <button onClick={() => setShowMenu(m => !m)} className="p-1 text-slate-400 hover:text-slate-600">
            <MoreVertical size={18} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-40">
              <button
                onClick={() => { onChange({ ...exercise, sets: [...exercise.sets, { kg: 0, reps: 10, warmup: true }] }); setShowMenu(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >+ Serie calentamiento</button>
              <button onClick={() => { onRemove(); setShowMenu(false) }} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
                Eliminar ejercicio
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="px-4 pb-2">
        <input
          value={exercise.notes || ''}
          onChange={e => onChange({ ...exercise, notes: e.target.value })}
          placeholder="Agregar notas aquí..."
          className="w-full text-sm text-slate-400 placeholder:text-slate-300 bg-transparent border-none outline-none"
        />
      </div>

      {/* Rest */}
      <div className="px-4 pb-3">
        <button onClick={() => setShowRest(v => !v)} className="flex items-center gap-2 active:opacity-70">
          <div className="w-5 h-5 rounded-full border-2 border-blue-400 flex items-center justify-center flex-shrink-0">
            <Timer size={10} className="text-blue-500" />
          </div>
          <span className="text-sm text-blue-500 font-medium">Descanso: {fmtRest(exercise.restSecs ?? DEFAULT_REST)}</span>
          <span className="text-xs text-blue-400">{showRest ? '▲' : '▼'}</span>
        </button>

        {showRest && (
          <div className="mt-3 bg-slate-50 rounded-2xl p-3 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {REST_PRESETS.map(p => (
                <button key={p.secs}
                  onClick={() => onChange({ ...exercise, restSecs: p.secs })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    (exercise.restSecs ?? DEFAULT_REST) === p.secs
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}>{p.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">Personalizar:</span>
              <input type="text"
                value={Math.floor((exercise.restSecs ?? DEFAULT_REST) / 60)}
                onChange={e => onChange({ ...exercise, restSecs: (parseInt(e.target.value) || 0) * 60 + ((exercise.restSecs ?? DEFAULT_REST) % 60) })}
                className="w-10 text-center border border-slate-200 rounded-lg py-1 text-sm font-bold bg-white outline-none focus:border-blue-400"
                inputMode="numeric"
              />
              <span className="text-sm text-slate-500">min</span>
              <input type="text"
                value={(exercise.restSecs ?? DEFAULT_REST) % 60}
                onChange={e => onChange({ ...exercise, restSecs: Math.floor((exercise.restSecs ?? DEFAULT_REST) / 60) * 60 + (parseInt(e.target.value) || 0) })}
                className="w-10 text-center border border-slate-200 rounded-lg py-1 text-sm font-bold bg-white outline-none focus:border-blue-400"
                inputMode="numeric"
              />
              <span className="text-sm text-slate-500">seg</span>
            </div>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[40px_1fr_1fr_1fr] items-center px-4 py-2 border-t border-b border-slate-200 bg-slate-50">
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Serie</div>
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anterior</div>
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">KG</div>
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reps</div>
      </div>

      {/* Sets */}
      {exercise.sets.map((set, i) => (
        <SetRow key={i} set={set} idx={i} onChange={s => updateSet(i, s)} onRemove={() => removeSet(i)} />
      ))}

      {/* Add set */}
      <button
        onClick={addSet}
        className="w-full py-3.5 flex items-center justify-center gap-2 text-slate-500 text-sm font-semibold bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors"
      >
        <Plus size={16} /> Agregar Serie
      </button>
    </div>
  )
}

// ── Routine Modal ──────────────────────────────────────────────────────────
function RoutineModal({ routine, onSave, onClose }) {
  const [draft, setDraft]       = useState(routine || { id: uid(), name: '', exercises: [] })
  const [showPicker, setShowPicker] = useState(false)

  const addExerciseFromPicker = (ex) => {
    setDraft(d => ({
      ...d,
      exercises: [...d.exercises, {
        id: uid(), name: ex.name, muscle: ex.muscle, equipment: ex.equipment,
        video: ex.video, restSecs: DEFAULT_REST, notes: '',
        sets: [{ reps: 10, kg: 0 }]
      }]
    }))
    setShowPicker(false)
  }

  const updateExercise = (i, ex) => {
    setDraft(d => { const exercises = [...d.exercises]; exercises[i] = ex; return { ...d, exercises } })
  }

  const removeExercise = (i) => {
    setDraft(d => ({ ...d, exercises: d.exercises.filter((_, idx) => idx !== i) }))
  }

  return (
    <>
      {showPicker && <ExercisePicker onSelect={addExerciseFromPicker} onClose={() => setShowPicker(false)} />}

      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 text-lg">{routine ? 'Editar rutina' : 'Nueva rutina'}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>

          <div className="p-5 space-y-4">
            <input
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              placeholder="Nombre de la rutina"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div>
              {draft.exercises.map((ex, i) => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  onChange={e => updateExercise(i, e)}
                  onRemove={() => removeExercise(i)}
                />
              ))}
            </div>

            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-2 w-full justify-center border-2 border-dashed border-slate-200 rounded-xl py-3 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Plus size={16} /> Añadir ejercicio
            </button>
          </div>

          <div className="flex gap-3 p-5 border-t border-slate-100">
            <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={() => draft.name.trim() && onSave(draft)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 font-medium disabled:opacity-40"
              disabled={!draft.name.trim()}
            >
              Guardar rutina
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Routines({ routines, setRoutines }) {
  const [modal, setModal]       = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [videoEx, setVideoEx]   = useState(null)

  const saveRoutine = (routine) => {
    setRoutines(rs => {
      const exists = rs.find(r => r.id === routine.id)
      return exists ? rs.map(r => r.id === routine.id ? routine : r) : [...rs, routine]
    })
    setModal(null)
  }

  const deleteRoutine = (id) => {
    if (confirm('¿Eliminar esta rutina?')) setRoutines(rs => rs.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-6">
      {videoEx && <VideoModal exercise={videoEx} onClose={() => setVideoEx(null)} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rutinas</h1>
          <p className="text-slate-500 text-sm mt-1">{routines.length} rutinas guardadas</p>
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm"
        >
          <Plus size={16} /> Nueva rutina
        </button>
      </div>

      {routines.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <p className="text-slate-400">Sin rutinas. Crea tu primera rutina.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map(r => {
            const totalSets = r.exercises.reduce((a, e) => a + e.sets.length, 0)
            const isOpen = expanded === r.id
            return (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <button className="flex-1 text-left" onClick={() => setExpanded(isOpen ? null : r.id)}>
                    <p className="font-semibold text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.exercises.length} ejercicios · {totalSets} series totales</p>
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setModal(r)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => deleteRoutine(r.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                    <button onClick={() => setExpanded(isOpen ? null : r.id)} className="p-2 text-slate-400">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-50 px-5 py-4 space-y-3">
                    {r.exercises.map(ex => {
                      const c = MUSCLE_COLORS[ex.muscle] ?? DEFAULT_MUSCLE_COLOR
                      return (
                        <div key={ex.id} className="flex items-start gap-3">
                          {ex.video ? (
                            <VideoThumb
                              src={`/exercise_videos_395/${ex.video}`}
                              borderColor={c.border}
                              onClick={() => setVideoEx(ex)}
                            />
                          ) : (
                            <div className={`w-11 h-11 rounded-2xl flex-shrink-0 ${c.bg} flex items-center justify-center`}>
                              <div className={`w-3 h-3 rounded-full ${c.dot}`} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-slate-700">{ex.name}</p>
                              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{ex.muscle}</span>
                            </div>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {ex.sets.map((s, i) => (
                                <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                                  {s.kg}kg × {s.reps}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <RoutineModal
          routine={modal === 'new' ? null : modal}
          onSave={saveRoutine}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
