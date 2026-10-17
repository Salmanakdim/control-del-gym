import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, X, ArrowLeft, Trash2, FileText } from 'lucide-react'
import MicButton from '../components/MicButton'

function fmtDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin  = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay  = Math.floor(diffMs / 86400000)
  if (diffMin < 1)  return 'Ahora mismo'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffHour < 24) return `Hace ${diffHour}h`
  if (diffDay === 1) return 'Ayer'
  if (diffDay < 7)   return `Hace ${diffDay} días`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function Notes() {
  const { user } = useAuth()

  const [notes, setNotes]     = useState([])
  const [query, setQuery]     = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [editing, setEditing] = useState(null) // null = list, note object = editor
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('notes')
      .select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    setNotes(data || [])
    setLoading(false)
  }

  async function createNote() {
    const { data } = await supabase.from('notes').insert({
      user_id: user.id, title: '', content: '', updated_at: new Date().toISOString(),
    }).select().single()
    if (data) {
      setNotes(p => [data, ...p])
      setEditing(data)
    }
  }

  async function saveNote(note) {
    clearTimeout(saveTimer.current)
    setNotes(p => p.map(n => n.id === note.id ? { ...note, updated_at: new Date().toISOString() } : n)
      .sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)))
    saveTimer.current = setTimeout(async () => {
      await supabase.from('notes').update({
        title: note.title, content: note.content, updated_at: new Date().toISOString(),
      }).eq('id', note.id)
    }, 800)
  }

  async function deleteNote(id) {
    await supabase.from('notes').delete().eq('id', id)
    setNotes(p => p.filter(n => n.id !== id))
    setEditing(null)
  }

  const filtered = notes.filter(n =>
    !query || n.title.toLowerCase().includes(query.toLowerCase()) || n.content.toLowerCase().includes(query.toLowerCase())
  )

  // Focus textarea when editor opens
  useEffect(() => {
    if (editing && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [editing?.id])

  // ── Editor ────────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] -mt-2 -mx-0">
        {/* Editor header */}
        <div className="flex items-center justify-between py-3 px-1 flex-shrink-0">
          <button onClick={() => { clearTimeout(saveTimer.current); setEditing(null) }}
            className="flex items-center gap-1.5 text-blue-600 font-semibold text-sm active:opacity-70">
            <ArrowLeft size={18}/> Notas
          </button>
          <button onClick={() => deleteNote(editing.id)}
            className="flex items-center gap-1.5 text-red-400 text-sm font-semibold active:opacity-70">
            <Trash2 size={15}/> Eliminar
          </button>
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            value={editing.title}
            onChange={e => { const n = { ...editing, title: e.target.value }; setEditing(n); saveNote(n) }}
            placeholder="Título"
            className="flex-1 min-w-0 text-2xl font-black text-slate-800 px-1 py-2 bg-transparent border-none outline-none placeholder-slate-300"
          />
          <MicButton
            onText={t => { const n = { ...editing, title: (editing.title ? editing.title + ' ' : '') + t }; setEditing(n); saveNote(n) }}
          />
        </div>

        {/* Date */}
        <p className="text-xs text-slate-400 px-1 mb-3 flex-shrink-0">{fmtDate(editing.updated_at)}</p>

        {/* Divider */}
        <div className="border-t border-slate-100 flex-shrink-0"/>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <textarea
            ref={textareaRef}
            value={editing.content}
            onChange={e => { const n = { ...editing, content: e.target.value }; setEditing(n); saveNote(n) }}
            placeholder="Escribe aquí..."
            className="flex-1 text-slate-700 text-sm leading-relaxed px-1 pt-3 pr-10 bg-transparent border-none outline-none resize-none placeholder-slate-300"
          />
          <MicButton
            className="absolute top-2 right-1"
            onText={t => { const n = { ...editing, content: (editing.content ? editing.content + ' ' : '') + t }; setEditing(n); saveNote(n) }}
          />
        </div>
      </div>
    )
  }

  // ── List ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        {showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-slate-100">
              <Search size={15} className="text-slate-400 flex-shrink-0"/>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar notas..."
                className="flex-1 text-sm text-slate-700 bg-transparent outline-none placeholder-slate-400"/>
            </div>
            <button onClick={() => { setShowSearch(false); setQuery('') }}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100">
              <X size={15} className="text-slate-500"/>
            </button>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-black text-slate-800">Notas</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {notes.length === 0 ? 'Crea tu primera nota' : `${notes.length} nota${notes.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSearch(true)}
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 active:bg-slate-50">
                <Search size={18} className="text-slate-600"/>
              </button>
              <button onClick={createNote}
                className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md active:bg-blue-700">
                <Plus size={20} className="text-white"/>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      )}

      {/* Empty state */}
      {!loading && notes.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-slate-600 font-bold text-lg">Sin notas</p>
          <p className="text-slate-400 text-sm mt-1 mb-5">Captura ideas, listas, pensamientos</p>
          <button onClick={createNote}
            className="bg-blue-600 text-white font-bold px-6 py-3 rounded-2xl text-sm shadow-md">
            + Nueva nota
          </button>
        </div>
      )}

      {/* No results */}
      {!loading && notes.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 font-semibold">Sin resultados para "{query}"</p>
        </div>
      )}

      {/* Notes grid — 2 columns */}
      {!loading && filtered.length > 0 && (
        <div className="columns-2 gap-3">
          {filtered.map(note => (
            <button key={note.id} onClick={() => setEditing(note)}
              className="break-inside-avoid w-full text-left bg-white rounded-2xl p-4 shadow-sm active:shadow-none active:scale-[0.98] transition-transform mb-3 block">
              {note.title ? (
                <p className="font-bold text-slate-800 text-sm leading-tight mb-1.5 line-clamp-2">{note.title}</p>
              ) : (
                <p className="font-semibold text-slate-400 text-sm italic mb-1.5">Sin título</p>
              )}
              {note.content && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-4 mb-2">{note.content}</p>
              )}
              {!note.content && !note.title && (
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={12} className="text-slate-300"/>
                  <span className="text-xs text-slate-300">Nota vacía</span>
                </div>
              )}
              <p className="text-[10px] text-slate-300 font-medium">{fmtDate(note.updated_at)}</p>
            </button>
          ))}
        </div>
      )}

      {/* FAB - always visible */}
      {notes.length > 0 && !showSearch && (
        <button onClick={createNote}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform z-30">
          <Plus size={24} className="text-white"/>
        </button>
      )}
    </div>
  )
}
