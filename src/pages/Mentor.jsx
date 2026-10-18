import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Plus, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const SYSTEM_PROMPT = `Eres un mentor de productividad personal llamado Mentor dentro de la app Flowlyday. Ayudas al usuario a planificar y organizar sus tareas de forma clara y accionable.

Cuando el usuario describa algo que necesita hacer:
1. Entiende el objetivo completo
2. Solo pregunta lo que genuinamente no puedas inferir (máximo 1 pregunta a la vez, solo si es realmente necesaria)
3. Estima tiempos realistas si el usuario no los menciona
4. Propón dividirlo en bloques concretos y manejables (mínimo 1, máximo 6)

Reglas importantes:
- Responde siempre en español, de forma concisa y amigable
- No hagas preguntas innecesarias
- Si la tarea es simple (ej: "llamar al médico"), crea solo 1 tarea sin complicar
- Cuando presentes el plan final, incluye EXACTAMENTE este bloque al final de tu mensaje (sin texto después):

<TASKS_JSON>
[{"title":"Nombre de la tarea","estimated_minutes":30,"note":"descripción opcional o vacío"}]
</TASKS_JSON>

Solo incluye el bloque JSON cuando estés presentando el plan final listo para crear.`

const WELCOME = `¡Hola! Soy tu mentor de productividad 🎯

Cuéntame qué necesitas hacer y te ayudo a organizarlo en pasos claros con tiempos realistas.

¿Qué tienes en mente?`

function parseTasksFromMessage(text) {
  const match = text.match(/<TASKS_JSON>([\s\S]*?)<\/TASKS_JSON>/)
  if (!match) return null
  try { return JSON.parse(match[1].trim()) } catch { return null }
}

function cleanMessage(text) {
  return text.replace(/<TASKS_JSON>[\s\S]*?<\/TASKS_JSON>/, '').trim()
}

function fmtTime(min) {
  if (!min) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default function Mentor({ setPage }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([
    { role: 'assistant', text: WELCOME, tasks: null }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [creatingIdx, setCreatingIdx] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function autoResize(el) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const updated = [...messages, { role: 'user', text, tasks: null }]
    setMessages(updated)
    setLoading(true)

    const history = updated
      .filter((_, i) => i > 0)
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))

    try {
      // La clave de la IA vive en el servidor (/api/claude); aquí solo va la sesión del usuario
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${session?.access_token || ''}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ system: SYSTEM_PROMPT, messages: history }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = data.error?.message || `Error ${res.status}`
        setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${errMsg}`, tasks: null }])
        setLoading(false)
        return
      }
      const raw = data.content?.[0]?.text || 'Lo siento, algo fue mal.'
      const tasks = parseTasksFromMessage(raw)
      const displayText = cleanMessage(raw)
      setMessages(prev => [...prev, { role: 'assistant', text: displayText, tasks }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ Error: ${err.message}`, tasks: null }])
    }
    setLoading(false)
  }

  async function createTasks(tasks, msgIdx) {
    setCreatingIdx(msgIdx)
    const inserts = tasks.map(t => ({
      user_id: user.id,
      title: t.title,
      note: t.note || null,
      folder_id: null,
      completed: false,
      steps: [],
      my_day: false,
      important: false,
    }))
    await supabase.from('tasks').insert(inserts)
    setCreatingIdx(null)
    setPage('tasks')
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 96px)' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 pb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
          <Sparkles size={20} className="text-white"/>
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-800">Mentor</h1>
          <p className="text-xs text-slate-400 font-medium">Asistente de productividad</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                <Bot size={14} className="text-white"/>
              </div>
            )}

            <div className="max-w-[85%] space-y-2">
              {msg.text && (
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white text-slate-700 rounded-tl-sm shadow-sm'
                }`}>
                  {msg.text}
                </div>
              )}

              {/* Plan card */}
              {msg.tasks && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #ede9fe' }}>
                  <div className="px-4 py-2.5 border-b border-slate-50"
                    style={{ background: 'linear-gradient(to right, #f5f3ff, #eff6ff)' }}>
                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#7c3aed' }}>
                      Plan propuesto · {fmtTime(msg.tasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0))} en total
                    </p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {msg.tasks.map((t, ti) => (
                      <div key={ti} className="flex items-start gap-3 px-4 py-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: '#ede9fe' }}>
                          <span className="text-[10px] font-black" style={{ color: '#7c3aed' }}>{ti + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                          {t.note && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t.note}</p>}
                        </div>
                        {t.estimated_minutes > 0 && (
                          <span className="text-xs font-bold text-slate-400 flex-shrink-0 mt-0.5 tabular-nums">
                            {fmtTime(t.estimated_minutes)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-slate-100">
                    <button
                      onClick={() => createTasks(msg.tasks, i)}
                      disabled={creatingIdx !== null}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white shadow-md active:opacity-90 disabled:opacity-60 transition-opacity"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                      {creatingIdx === i ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                      ) : (
                        <><Plus size={16}/> Crear en Tareas</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing dots */}
        {loading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
              <Bot size={14} className="text-white"/>
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
              {[0, 150, 300].map(delay => (
                <span key={delay} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}/>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 pt-2">
        <div className="flex items-end gap-2 bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(e.target) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="¿Qué necesitas hacer?"
            rows={1}
            className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
            style={{ resize: 'none', minHeight: 24, maxHeight: 120, lineHeight: '1.5' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
            <Send size={15} className="text-white"/>
          </button>
        </div>
      </div>
    </div>
  )
}
