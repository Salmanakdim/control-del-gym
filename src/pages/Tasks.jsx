import { useState, useEffect } from 'react'
import { Plus, Trash2, Calendar, ChevronDown, ChevronUp, Circle, CheckCircle2, Folder, FolderPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PRIORITIES = ['Alta', 'Media', 'Baja']

const PRIORITY_COLORS = {
  Alta:  { dot: 'bg-red-500',   text: 'text-red-600' },
  Media: { dot: 'bg-amber-400', text: 'text-amber-600' },
  Baja:  { dot: 'bg-slate-400', text: 'text-slate-500' },
}

const COLOR_OPTIONS = [
  { id: 'blue',   bg: 'bg-blue-500',   light: 'bg-blue-100',   text: 'text-blue-700' },
  { id: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
  { id: 'green',  bg: 'bg-green-500',  light: 'bg-green-100',  text: 'text-green-700' },
  { id: 'red',    bg: 'bg-red-500',    light: 'bg-red-100',    text: 'text-red-700' },
  { id: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700' },
  { id: 'pink',   bg: 'bg-pink-500',   light: 'bg-pink-100',   text: 'text-pink-700' },
  { id: 'teal',   bg: 'bg-teal-500',   light: 'bg-teal-100',   text: 'text-teal-700' },
  { id: 'amber',  bg: 'bg-amber-500',  light: 'bg-amber-100',  text: 'text-amber-700' },
]

function getColor(colorId) {
  return COLOR_OPTIONS.find(c => c.id === colorId) || COLOR_OPTIONS[0]
}

function today() { return new Date().toISOString().split('T')[0] }

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  const t = today()
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (dateStr === t) return 'Hoy'
  if (dateStr === tomorrow) return 'Mañana'
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function isPast(dateStr) { return dateStr && dateStr < today() }
function isToday(dateStr) { return dateStr === today() }

export default function Tasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [filterFolder, setFilterFolder] = useState('all')
  const [showNewFolder, setShowNewFolder] = useState(false)

  // New task form
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('Media')
  const [dueDate, setDueDate] = useState('')
  const [folderId, setFolderId] = useState('')

  // New folder form
  const [folderName, setFolderName] = useState('')
  const [folderColor, setFolderColor] = useState('blue')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: f }, { data: t }] = await Promise.all([
      supabase.from('folders').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    setFolders(f || [])
    setTasks(t || [])
    setLoading(false)
  }

  async function addFolder(e) {
    e.preventDefault()
    if (!folderName.trim()) return
    const { data } = await supabase.from('folders').insert({
      user_id: user.id, name: folderName.trim(), color: folderColor
    }).select().single()
    if (data) { setFolders(prev => [...prev, data]); setFolderId(data.id) }
    setFolderName('')
    setFolderColor('blue')
    setShowNewFolder(false)
  }

  async function deleteFolder(id) {
    await supabase.from('folders').delete().eq('id', id)
    setFolders(prev => prev.filter(f => f.id !== id))
    setTasks(prev => prev.map(t => t.folder_id === id ? { ...t, folder_id: null } : t))
    if (filterFolder === id) setFilterFolder('all')
  }

  async function addTask(e) {
    e.preventDefault()
    if (!title.trim()) return
    const { data } = await supabase.from('tasks').insert({
      user_id: user.id,
      title: title.trim(),
      priority,
      due_date: dueDate || null,
      folder_id: folderId || null,
      completed: false,
    }).select().single()
    if (data) setTasks(prev => [data, ...prev])
    setTitle('')
    setDueDate('')
    setShowAdd(false)
  }

  async function toggleTask(task) {
    const updates = { completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null }
    await supabase.from('tasks').update(updates).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t))
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const filtered = tasks.filter(t => filterFolder === 'all' || t.folder_id === filterFolder)
  const pending = filtered.filter(t => !t.completed)
  const completed = filtered.filter(t => t.completed)
  const todayTasks = pending.filter(t => !t.due_date || isToday(t.due_date) || isPast(t.due_date))
  const upcomingTasks = pending.filter(t => t.due_date && t.due_date > today())

  function TaskCard({ task }) {
    const folder = folders.find(f => f.id === task.folder_id)
    const fc = folder ? getColor(folder.color) : null
    const pr = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Media
    return (
      <div className={`flex items-center gap-3 p-3.5 rounded-2xl bg-white shadow-sm border border-slate-100 group transition-opacity ${task.completed ? 'opacity-50' : ''}`}>
        <button onClick={() => toggleTask(task)} className="flex-shrink-0 text-slate-300 hover:text-blue-500 transition-colors">
          {task.completed
            ? <CheckCircle2 size={22} className="text-blue-500" />
            : <Circle size={22} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium text-slate-800 leading-tight ${task.completed ? 'line-through text-slate-400' : ''}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {folder && (
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${fc.light} ${fc.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${fc.bg}`} />
                {folder.name}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${pr.dot}`} />
              <span className={pr.text}>{task.priority}</span>
            </span>
            {task.due_date && (
              <span className={`flex items-center gap-1 text-xs ${isPast(task.due_date) && !task.completed ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                <Calendar size={11} />
                {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => deleteTask(task.id)}
          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0">
          <Trash2 size={16} />
        </button>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Tareas</h1>
          <p className="text-sm text-slate-400">{pending.length} pendientes</p>
        </div>
        <button onClick={() => { setShowAdd(v => !v); setShowNewFolder(false) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow transition-colors">
          <Plus size={16} />
          Nueva tarea
        </button>
      </div>

      {/* New task form */}
      {showAdd && (
        <form onSubmit={addTask} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="¿Qué tienes que hacer?"
            className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 outline-none border-b border-slate-100 pb-2"
          />
          <div className="flex flex-wrap gap-2">
            <select value={folderId} onChange={e => setFolderId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 outline-none">
              <option value="">Sin carpeta</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 outline-none">
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 outline-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
              Añadir
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="text-slate-400 hover:text-slate-600 text-xs px-3 py-2">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Folders */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carpetas</p>
          <button onClick={() => { setShowNewFolder(v => !v); setShowAdd(false) }}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold">
            <FolderPlus size={14} />
            Nueva carpeta
          </button>
        </div>

        {/* New folder form */}
        {showNewFolder && (
          <form onSubmit={addFolder} className="bg-white rounded-2xl border border-slate-100 p-3.5 space-y-3">
            <input
              autoFocus
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              placeholder="Nombre de la carpeta"
              className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 outline-none border-b border-slate-100 pb-2"
            />
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c.id} type="button" onClick={() => setFolderColor(c.id)}
                  className={`w-6 h-6 rounded-full ${c.bg} transition-transform ${folderColor === c.id ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg">
                Crear
              </button>
              <button type="button" onClick={() => setShowNewFolder(false)}
                className="text-slate-400 text-xs px-3 py-2">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Folder filter chips */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterFolder('all')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              filterFolder === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
            Todas
          </button>
          {folders.map(f => {
            const c = getColor(f.color)
            const isActive = filterFolder === f.id
            return (
              <div key={f.id} className="relative group/folder flex items-center">
                <button onClick={() => setFilterFolder(f.id)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    isActive ? `${c.bg} text-white` : `bg-white ${c.text} border border-slate-200`
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/70' : c.bg}`} />
                  {f.name}
                </button>
                <button onClick={() => deleteFolder(f.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover/folder:flex items-center justify-center">
                  <X size={9} />
                </button>
              </div>
            )
          })}
          {folders.length === 0 && !showNewFolder && (
            <p className="text-xs text-slate-400 italic">Crea una carpeta para organizar tus tareas</p>
          )}
        </div>
      </div>

      {/* Today tasks */}
      {todayTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Hoy</p>
          {todayTasks.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      {/* Upcoming tasks */}
      {upcomingTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Próximas</p>
          {upcomingTasks.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      {/* Empty state */}
      {pending.length === 0 && (
        <div className="text-center py-14 text-slate-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="font-medium">Todo al día</p>
          <p className="text-sm mt-1">Añade una tarea para empezar</p>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <button onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider px-1 hover:text-slate-600 transition-colors">
            {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Completadas ({completed.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 mt-2">
              {completed.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
