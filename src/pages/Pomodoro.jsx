import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePomodoro, fmtPomTime } from '../contexts/PomodoroContext'
import { SkipForward, RotateCcw, Play, Pause, ChevronRight, ChevronDown,
  SlidersHorizontal, X, Minus, Plus, ArrowLeft, Inbox, CalendarDays } from 'lucide-react'

const MODE_LABELS = { work: 'Trabajo', break: 'Descanso', longbreak: 'Descanso largo' }
const MODE_COLORS = { work: '#2563eb', break: '#16a34a', longbreak: '#7c3aed' }
const LIST_COLORS = { blue:'#3b82f6', purple:'#a855f7', green:'#22c55e', red:'#ef4444', orange:'#f97316', pink:'#ec4899', teal:'#14b8a6', amber:'#f59e0b' }
const EV_COLORS   = { blue:'#2563eb', violet:'#7c3aed', green:'#16a34a', red:'#dc2626', orange:'#ea580c', pink:'#db2777' }
function listColor(id) { return LIST_COLORS[id] || '#64748b' }
function evColor(v)    { return EV_COLORS[v]    || '#2563eb' }
function fmtHM(t)      { return t ? t.slice(0,5) : '' }

function Ring({ progress, color, size = 220 }) {
  const R = (size / 2) - 14
  const C = 2 * Math.PI * R
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="#f1f5f9" strokeWidth={12}/>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke={color} strokeWidth={12}
        strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, progress)))}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}/>
    </svg>
  )
}

function StepInput({ label, value, onChange, min = 1, max = 90 }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div>
        <p className="font-semibold text-slate-800 text-sm">{label}</p>
        <p className="text-xs text-slate-400">{min}–{max} min</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - 5))}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200">
          <Minus size={14} className="text-slate-600"/>
        </button>
        <span className="text-lg font-black text-slate-800 w-12 text-center tabular-nums">
          {value}<span className="text-xs font-normal text-slate-400 ml-0.5">m</span>
        </span>
        <button onClick={() => onChange(Math.min(max, value + 5))}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200">
          <Plus size={14} className="text-slate-600"/>
        </button>
      </div>
    </div>
  )
}

export default function Pomodoro() {
  const { user } = useAuth()
  const { pom, settings, toggle, reset, skip, setMode, setTask, applySettings } = usePomodoro()

  const [folders, setFolders] = useState([])
  const [groups, setGroups]   = useState([])
  const [tasks, setTasks]     = useState([])
  const [calEvents, setCalEvents] = useState([])  // today's calendar events

  // Picker: null=list level | 'inbox'|'events'|folderId = detail level
  const [showTaskPicker, setShowTaskPicker]       = useState(false)
  const [pickerFolder, setPickerFolder]           = useState(null)
  const [collapsedGroups, setCollapsedGroups]     = useState(new Set())

  const [showSettings, setShowSettings] = useState(false)
  const [draft, setDraft] = useState({ ...settings })

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      supabase.from('folders').select('*').eq('user_id', user.id).order('position'),
      supabase.from('groups').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('tasks').select('id, title, folder_id')
        .eq('user_id', user.id).eq('completed', false).order('position'),
      supabase.from('calendar_events').select('id, title, start_time, end_time, color, all_day')
        .eq('user_id', user.id).eq('date', today).order('start_time'),
    ]).then(([{ data:f },{ data:g },{ data:t },{ data:e }]) => {
      setFolders(f || [])
      setGroups(g || [])
      setTasks(t || [])
      setCalEvents(e || [])
    })
  }, [])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }, [])

  function toggleGroup(id) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openPicker()  { setPickerFolder(null); setShowTaskPicker(true) }
  function closePicker() { setShowTaskPicker(false); setPickerFolder(null) }

  function openSettings() { setDraft({ ...settings }); setShowSettings(true) }
  function saveSettings() { applySettings(draft); setShowSettings(false) }

  const color    = MODE_COLORS[pom.mode]
  const total    = pom.mode === 'work' ? settings.workMin * 60
    : pom.mode === 'break' ? settings.breakMin * 60 : settings.longbreakMin * 60
  const progress = pom.secondsLeft / total

  // Tasks for currently selected picker folder
  const pickerTasks = pickerFolder === 'inbox'
    ? tasks.filter(t => !t.folder_id)
    : pickerFolder && pickerFolder !== 'events'
      ? tasks.filter(t => t.folder_id === pickerFolder)
      : []

  const inboxCount = tasks.filter(t => !t.folder_id).length
  const ungroupedFolders = folders.filter(f => !f.group_id)

  // Folder row reusable
  function FolderRow({ folder }) {
    const count = tasks.filter(t => t.folder_id === folder.id).length
    const c     = listColor(folder.color)
    return (
      <button onClick={() => setPickerFolder(folder.id)}
        className="w-full flex items-center gap-3 px-5 py-3 active:bg-slate-50 text-left">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: c + '20' }}>
          <div className="w-3 h-3 rounded-full" style={{ background: c }}/>
        </div>
        <span className="flex-1 font-semibold text-slate-700 text-sm">{folder.name}</span>
        <span className="text-xs text-slate-400 font-medium">{count}</span>
        <ChevronRight size={14} className="text-slate-300"/>
      </button>
    )
  }

  return (
    <div className="max-w-sm mx-auto space-y-5 pb-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Pomodoro</h1>
          <p className="text-sm text-slate-500 mt-0.5">Técnica de concentración</p>
        </div>
        <button onClick={openSettings}
          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 active:bg-slate-50">
          <SlidersHorizontal size={18} className="text-slate-600"/>
        </button>
      </div>

      {/* Mode tabs */}
      <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm">
        {Object.entries(MODE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setMode(key)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${pom.mode===key?'text-white shadow':'text-slate-500'}`}
            style={{ background: pom.mode===key ? MODE_COLORS[key] : 'transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Timer */}
      <div className="bg-white rounded-3xl shadow-sm flex flex-col items-center py-8">
        <div className="relative flex items-center justify-center">
          <Ring progress={progress} color={color}/>
          <div className="absolute flex flex-col items-center">
            <span className="text-5xl font-black text-slate-800 tabular-nums" style={{ letterSpacing:'-0.02em' }}>
              {fmtPomTime(pom.secondsLeft)}
            </span>
            <span className="text-sm font-semibold mt-1" style={{ color }}>{MODE_LABELS[pom.mode]}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-6">
          <button onClick={reset} className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200">
            <RotateCcw size={18} className="text-slate-500"/>
          </button>
          <button onClick={toggle} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            style={{ background: color }}>
            {pom.running ? <Pause size={26} fill="white" className="text-white"/> : <Play size={26} fill="white" className="text-white" style={{ marginLeft:3 }}/>}
          </button>
          <button onClick={skip} className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200">
            <SkipForward size={18} className="text-slate-500"/>
          </button>
        </div>
      </div>

      {/* Linked item */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <button onClick={openPicker} className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{pom.taskId?.startsWith('ev_') ? '📅' : '📌'}</span>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                {pom.taskId?.startsWith('ev_') ? 'Evento vinculado' : 'Tarea vinculada'}
              </p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">{pom.taskTitle || 'Sin vincular — sesión libre'}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400"/>
        </button>
        {pom.taskTitle && (
          <div className="border-t border-slate-50">
            <button onClick={() => setTask(null, '')}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 font-semibold active:bg-slate-50">
              <X size={11}/> Quitar
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Sesión de hoy</p>
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5 flex-wrap flex-1">
            {pom.pomoCount === 0
              ? <span className="text-sm text-slate-400">Aún no has completado ningún pomodoro</span>
              : Array.from({ length: pom.pomoCount }, (_, i) => <span key={i} className="text-2xl">🍅</span>)
            }
          </div>
          {pom.pomoCount > 0 && (
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-slate-800">{pom.pomoCount}</p>
              <p className="text-xs text-slate-400 -mt-1">pomodoros</p>
            </div>
          )}
        </div>
        {pom.pomoCount >= 4 && (
          <p className="text-xs text-violet-600 font-semibold mt-2">
            🌟 {Math.floor(pom.pomoCount/4)} ciclo{Math.floor(pom.pomoCount/4)!==1?'s':''} completo{Math.floor(pom.pomoCount/4)!==1?'s':''}
          </p>
        )}
      </div>

      {/* ── Task / Event picker ─────────────────────────── */}
      {showTaskPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={closePicker}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[78vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
              {pickerFolder !== null ? (
                <button onClick={() => setPickerFolder(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 flex-shrink-0">
                  <ArrowLeft size={16} className="text-slate-600"/>
                </button>
              ) : <div className="w-8"/>}
              <p className="font-bold text-slate-800 flex-1 text-base">
                {pickerFolder === null     ? 'Vincular al Pomodoro' :
                 pickerFolder === 'inbox'  ? 'Bandeja de entrada' :
                 pickerFolder === 'events' ? 'Eventos de hoy' :
                 folders.find(f => f.id === pickerFolder)?.name || 'Lista'}
              </p>
              <button onClick={closePicker}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 flex-shrink-0">
                <X size={16} className="text-slate-500"/>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">

              {/* ── Level 1: folder + event list ── */}
              {pickerFolder === null && (
                <div className="py-2">

                  {/* Eventos de hoy */}
                  <button onClick={() => setPickerFolder('events')}
                    className="w-full flex items-center gap-3 px-5 py-3 active:bg-slate-50">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <CalendarDays size={15} className="text-blue-500"/>
                    </div>
                    <span className="flex-1 text-left font-semibold text-slate-700 text-sm">Eventos de hoy</span>
                    <span className="text-xs text-slate-400 font-medium">{calEvents.length}</span>
                    <ChevronRight size={14} className="text-slate-300"/>
                  </button>

                  {/* Bandeja de entrada */}
                  {inboxCount > 0 && (
                    <button onClick={() => setPickerFolder('inbox')}
                      className="w-full flex items-center gap-3 px-5 py-3 active:bg-slate-50">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Inbox size={15} className="text-slate-500"/>
                      </div>
                      <span className="flex-1 text-left font-semibold text-slate-700 text-sm">Bandeja de entrada</span>
                      <span className="text-xs text-slate-400 font-medium">{inboxCount}</span>
                      <ChevronRight size={14} className="text-slate-300"/>
                    </button>
                  )}

                  {/* Separator */}
                  {(inboxCount > 0 || calEvents.length > 0) && ungroupedFolders.length + groups.length > 0 && (
                    <div className="border-t border-slate-100 my-2"/>
                  )}

                  {/* Ungrouped folders */}
                  {ungroupedFolders.map(f => <FolderRow key={f.id} folder={f}/>)}

                  {/* Groups — collapsible */}
                  {groups.map(g => {
                    const gFolders = folders.filter(f => f.group_id === g.id)
                    if (!gFolders.length) return null
                    const collapsed = collapsedGroups.has(g.id)
                    return (
                      <div key={g.id}>
                        <button onClick={() => toggleGroup(g.id)}
                          className="w-full flex items-center justify-between px-5 py-2.5 active:bg-slate-50">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{g.name}</span>
                          <ChevronDown size={14} className="text-slate-300 transition-transform duration-200"
                            style={{ transform: collapsed ? 'rotate(-90deg)' : 'none' }}/>
                        </button>
                        {!collapsed && gFolders.map(f => <FolderRow key={f.id} folder={f}/>)}
                      </div>
                    )
                  })}

                  {folders.length === 0 && inboxCount === 0 && calEvents.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-10">No hay tareas ni eventos hoy</p>
                  )}

                  {/* Clear selection */}
                  {pom.taskTitle && (
                    <div className="border-t border-slate-100 mt-2 px-5 py-3">
                      <button onClick={() => { setTask(null, ''); closePicker() }}
                        className="text-sm text-slate-400 font-medium">
                        Quitar vinculación actual
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Level 2: tasks in folder ── */}
              {pickerFolder !== null && pickerFolder !== 'events' && (
                <div className="py-2">
                  {pickerTasks.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-10">Sin tareas pendientes en esta lista</p>
                  ) : pickerTasks.map(t => {
                    const sel = pom.taskId === t.id
                    const fColor = pickerFolder === 'inbox' ? '#64748b' : listColor(folders.find(f=>f.id===pickerFolder)?.color)
                    return (
                      <button key={t.id} onClick={() => { setTask(t.id, t.title); closePicker() }}
                        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left active:bg-slate-50 ${sel?'bg-blue-50':''}`}>
                        <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                          style={{ borderColor: sel ? fColor : '#cbd5e1', background: sel ? fColor : 'transparent' }}>
                          {sel && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                        </div>
                        <span className="text-sm font-medium flex-1 leading-snug" style={{ color: sel ? fColor : '#374151' }}>
                          {t.title}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* ── Level 2: today's events ── */}
              {pickerFolder === 'events' && (
                <div className="py-2">
                  {calEvents.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-10">No hay eventos hoy</p>
                  ) : calEvents.map(e => {
                    const sel = pom.taskId === 'ev_' + e.id
                    const c   = evColor(e.color)
                    return (
                      <button key={e.id} onClick={() => { setTask('ev_'+e.id, e.title); closePicker() }}
                        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left active:bg-slate-50 ${sel?'bg-blue-50':''}`}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c }}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 leading-tight">{e.title}</p>
                          {!e.all_day && e.start_time && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {fmtHM(e.start_time)}{e.end_time ? ` → ${fmtHM(e.end_time)}` : ''}
                            </p>
                          )}
                        </div>
                        {sel && <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-white"/>
                        </div>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Settings modal ─────────────────────────────── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Personalizar</h3>
                <p className="text-xs text-slate-400 mt-0.5">Ajusta los tiempos de cada fase</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100">
                <X size={16} className="text-slate-500"/>
              </button>
            </div>
            <div className="px-5 pb-2">
              <StepInput label="Trabajo"        value={draft.workMin}      onChange={v => setDraft(d=>({...d,workMin:v}))}      min={1} max={90}/>
              <StepInput label="Descanso corto" value={draft.breakMin}     onChange={v => setDraft(d=>({...d,breakMin:v}))}     min={1} max={30}/>
              <StepInput label="Descanso largo" value={draft.longbreakMin} onChange={v => setDraft(d=>({...d,longbreakMin:v}))} min={5} max={60}/>
            </div>
            <div className="mx-5 mb-4 mt-1 bg-slate-50 rounded-2xl px-4 py-3 flex justify-around">
              {[['Trabajo',draft.workMin,'#2563eb'],['Descanso',draft.breakMin,'#16a34a'],['L. break',draft.longbreakMin,'#7c3aed']].map(([l,m,c])=>(
                <div key={l} className="text-center">
                  <p className="text-lg font-black" style={{color:c}}>{m}m</p>
                  <p className="text-[10px] text-slate-400 font-medium">{l}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowSettings(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm">Cancelar</button>
              <button onClick={saveSettings} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl text-sm shadow-md">Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
