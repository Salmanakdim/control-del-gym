import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Laptop, Play, Pause, Square, SkipForward, FolderOpen, Download, Film, Image as ImageIcon, Copy, Check, Unplug, Clapperboard, Timer, ChevronDown, ChevronUp } from 'lucide-react'

// Controla la extensión de Google Flow del portátil desde aquí (móvil).
// La extensión manda su estado cada pocos segundos a flow_devices y recoge las
// órdenes de flow_commands (ver supabase_flow_remote.sql).

const ONLINE_MS = 20000
const RUNS = ['run_all', 'run_images', 'run_videos', 'join', 'download']

function newSecret() {
  const a = new Uint8Array(24)
  crypto.getRandomValues(a)
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('')
}
const codeFor = (secret) => btoa(JSON.stringify({ u: import.meta.env.VITE_SUPABASE_URL, k: import.meta.env.VITE_SUPABASE_KEY, s: secret }))
const parseResult = (r) => { try { return JSON.parse(r || '{}') } catch { return { text: r || '' } } }

function Bar({ done, total, color }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: pct + '%' }} />
    </div>
  )
}

function Btn({ onClick, disabled, children, kind = 'light', className = '' }) {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    light: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
    green: 'bg-green-600 text-white hover:bg-green-700',
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[kind]} ${className}`}>
      {children}
    </button>
  )
}

export default function FlowRemote() {
  const [devices, setDevices] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState('')       // action waiting for the laptop
  const [toast, setToast] = useState('')
  const [ask, setAsk] = useState(null)             // { text, action, payload }
  const [delay, setDelay] = useState('')
  const [open, setOpen] = useState({})
  const [now, setNow] = useState(() => Date.now())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    load()
    const t = setInterval(() => { if (!document.hidden) { load(); setNow(Date.now()) } }, 2500)
    return () => { alive.current = false; clearInterval(t) }
  }, [])

  async function load() {
    const { data, error } = await supabase.from('flow_devices').select('*').order('created_at')
    if (error) {
      setSetupError(/does not exist|relation|schema cache/i.test(error.message) ? 'missing' : error.message)
    } else {
      setSetupError('')
      setDevices(data || [])
    }
    setLoaded(true)
  }


  const device = devices[0]
  const st = device?.state || {}
  const online = device?.updated_at && now - new Date(device.updated_at).getTime() < ONLINE_MS


  async function connect() {
    const { error } = await supabase.from('flow_devices').insert({ name: 'Portátil', secret: newSecret() })
    if (error) { setToast('⚠ ' + error.message); return }
    await load()
    setShowCode(true)
  }

  async function disconnect() {
    if (!device || !confirm('¿Desconectar el portátil? La extensión dejará de recibir órdenes hasta que pegues un código nuevo.')) return
    await supabase.from('flow_devices').delete().eq('id', device.id)
    setShowCode(false)
    load()
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeFor(device.secret))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { setToast('No pude copiar: mantené pulsado el código y copialo a mano') }
  }

  // Sends an order and waits for the extension's answer
  async function send(action, payload = {}) {
    if (!device) return
    setPending(action)
    setToast('')
    const { data, error } = await supabase.from('flow_commands')
      .insert({ device_id: device.id, action, payload }).select('id').single()
    if (error) { setPending(''); setToast('⚠ ' + error.message); return }
    let row = null
    for (let i = 0; i < 60 && alive.current; i++) {
      await new Promise(r => setTimeout(r, 1200))
      const res = await supabase.from('flow_commands').select('status,result').eq('id', data.id).single()
      if (res.data && (res.data.status === 'done' || res.data.status === 'failed')) { row = res.data; break }
    }
    setPending('')
    if (!row) { setToast('⌛ El portátil todavía no contestó. ¿Está encendido con Flow abierto?'); return }
    const out = parseResult(row.result)
    // A run is asked first without confirming: its question comes back here
    if (RUNS.includes(action) && !payload.confirm && out.asked) {
      setAsk({ text: out.text, action, payload })
      return
    }
    setToast(out.text || (row.status === 'done' ? '✓ Hecho' : '⚠ No salió'))
    load()
  }

  const run = (action, ep) => send(action, { id: ep.id })

  if (!loaded) return <div className="p-6 text-slate-400">Cargando…</div>

  if (setupError === 'missing') return (
    <div className="max-w-xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-black text-slate-800">Flow</h1>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 space-y-2">
        <p className="font-bold">Falta un paso en Supabase (solo una vez)</p>
        <p>En supabase.com → tu proyecto → <b>SQL Editor</b>, pegá el contenido del archivo <b>supabase_flow_remote.sql</b> y pulsá <b>Run</b>. Después volvé aquí.</p>
      </div>
    </div>
  )

  const episodes = st.episodes || []
  const groups = [['yt', '▶️ YouTube'], ['ecom', '🛒 Ecom']].map(([k, label]) => [label, episodes.filter(e => (e.kind || 'yt') === k)]).filter(([, list]) => list.length)
  const busy = !!pending
  const canRun = online && !busy && !st.running

  return (
    <div className="max-w-xl mx-auto p-4 pb-24 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center"><Clapperboard size={20} className="text-white" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-800 leading-tight">Flow</h1>
          <p className="text-xs text-slate-400">Controlá la extensión de Google Flow del portátil</p>
        </div>
      </div>

      {setupError && <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3">⚠ {setupError}</div>}

      {!device ? (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <p className="font-bold text-slate-800 flex items-center gap-2"><Laptop size={18} /> Conectar el portátil</p>
          <p className="text-sm text-slate-500">Se crea un código. Lo pegás una vez en la extensión (pestaña <b>Control</b> → "📱 Control desde el móvil") y listo.</p>
          <Btn kind="primary" onClick={connect} className="w-full">Conectar portátil</Btn>
        </div>
      ) : (
        <>
          {/* Estado del portátil */}
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-slate-300'}`} />
              <span className="font-bold text-slate-800 flex-1">{online ? 'Portátil conectado' : 'Portátil sin conexión'}</span>
              <button onClick={() => setShowCode(v => !v)} className="text-xs text-blue-600 font-semibold">{showCode ? 'Ocultar código' : 'Ver código'}</button>
            </div>
            {!online && (
              <p className="text-xs text-slate-500">
                {device.updated_at ? 'Último contacto: ' + new Date(device.updated_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '. ' : 'Todavía no se conectó. '}
                El portátil tiene que estar encendido, con Chrome y la pestaña de Flow abierta delante, y el código pegado en la extensión.
              </p>
            )}
            {showCode && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <p className="text-xs text-slate-500">Pegalo en la extensión: pestaña <b>Control</b> → "📱 Control desde el móvil" → Conectar. No lo compartas: con él se controla tu Flow.</p>
                <p className="text-[11px] font-mono break-all text-slate-700 select-all">{codeFor(device.secret)}</p>
                <div className="flex gap-2">
                  <Btn onClick={copyCode} className="flex-1">{copied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar código</>}</Btn>
                  <Btn kind="danger" onClick={disconnect}><Unplug size={15} /> Desconectar</Btn>
                </div>
              </div>
            )}
            {online && (
              <>
                {st.project?.name && <p className="text-xs text-slate-500" dir="auto">Proyecto abierto: <b>{st.project.name}</b></p>}
                <div className={`rounded-xl p-3 text-sm ${st.running ? 'bg-blue-50 text-blue-900' : 'bg-slate-50 text-slate-600'}`}>
                  <p className="font-bold">
                    {st.pausedAt ? '⏸ En pausa · siguiente: ' + st.pausedAt
                      : st.userPaused ? '⏳ Pausando al terminar lo que está en curso…'
                      : st.running ? '▶ Trabajando' : 'Parado'}
                  </p>
                  {st.countdown && <p className="text-lg font-black tabular-nums mt-1">{st.countdown}</p>}
                  {st.status && <p className="mt-1 text-xs whitespace-pre-wrap" dir="auto">{st.status}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {st.userPaused
                    ? <Btn kind="green" disabled={busy} onClick={() => send('continue')}><Play size={15} /> Continuar</Btn>
                    : <Btn disabled={busy || !st.running} onClick={() => send('pause')}><Pause size={15} /> Pausar</Btn>}
                  <Btn kind="danger" disabled={busy || !st.running} onClick={() => confirm('¿Detener? Termina lo que está en curso y no sigue.') && send('stop')}><Square size={15} /> Parar</Btn>
                  {st.countdown && <Btn disabled={busy} onClick={() => send('skip')} className="col-span-2"><SkipForward size={15} /> Hacer ya (sin esperar)</Btn>}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Timer size={15} />
                  <span>Espera antes de cada acción</span>
                  <input type="number" min="0" max="3600" value={delay === '' ? String(st.delay ?? 0) : delay} onChange={e => setDelay(e.target.value)}
                    className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                  <span>s</span>
                  <button disabled={busy} onClick={() => send('delay', { seconds: parseInt(delay === '' ? st.delay : delay, 10) || 0 })} className="text-blue-600 font-semibold text-xs disabled:opacity-40">Guardar</button>
                </div>
              </>
            )}
          </div>

          {pending && <div className="bg-blue-50 text-blue-800 text-sm rounded-xl p-3">Mandando al portátil… esperando respuesta</div>}
          {toast && <div className="bg-white shadow-sm rounded-xl p-3 text-sm text-slate-700 whitespace-pre-wrap" dir="auto" onClick={() => setToast('')}>{toast}</div>}

          {/* Episodios y anuncios */}
          {online && !episodes.length && <p className="text-sm text-slate-400 text-center">La extensión no tiene episodios ni anuncios todavía.</p>}
          {groups.map(([label, list]) => (
            <div key={label} className="space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">{label}</p>
              {list.map(ep => {
                const here = ep.projectId && st.project?.id === ep.projectId
                const isOpen = open[ep.id] ?? (ep.waiting || ep.undecided?.length > 0)
                const choices = [ep.waiting, ...(ep.undecided || []).filter(u => !ep.waiting || u.n !== ep.waiting.n)].filter(Boolean)
                return (
                  <div key={ep.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                    <button className="w-full flex items-center gap-2 text-left" onClick={() => setOpen(o => ({ ...o, [ep.id]: !isOpen }))}>
                      <span className="font-bold text-slate-800 flex-1" dir="auto">{ep.title}</span>
                      {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-500"><span>🖼 Imágenes</span><span>{ep.imgs.done}/{ep.imgs.total}{ep.imgs.failed ? ` · ✗ ${ep.imgs.failed}` : ''}</span></div>
                      <Bar done={ep.imgs.done} total={ep.imgs.total} color="bg-violet-500" />
                      <div className="flex justify-between text-xs text-slate-500"><span>🎬 Videos</span><span>{ep.vids.done}/{ep.vids.total}{ep.vids.failed ? ` · ✗ ${ep.vids.failed}` : ''}</span></div>
                      <Bar done={ep.vids.done} total={ep.vids.total} color="bg-blue-500" />
                    </div>

                    {choices.map(ch => (
                      <div key={ch.n} className={`rounded-xl p-3 ${ep.waiting && ch.n === ep.waiting.n ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                        <p className="text-sm font-bold text-slate-700 mb-2">👆 ¿Qué versión de la Imagen {ch.n}?</p>
                        <div className="flex gap-2 flex-wrap">
                          {ch.versions.map(v => (
                            <button key={v.letter} disabled={busy || !online} onClick={() => send('choose', { id: ep.id, n: ch.n, letter: v.letter })}
                              className={`relative w-24 h-32 rounded-xl overflow-hidden border-2 bg-slate-200 ${ch.chosen === v.letter ? 'border-blue-600 ring-2 ring-blue-200' : 'border-transparent'}`}>
                              {v.thumb ? <img src={v.thumb} alt={v.letter} className="w-full h-full object-cover" /> : <span className="text-2xl font-black text-slate-500">{v.letter}</span>}
                              <span className="absolute left-1 bottom-1 bg-black/70 text-white text-xs font-bold px-2 rounded">{v.letter}</span>
                            </button>
                          ))}
                        </div>
                        {ep.waiting && ch.n === ep.waiting.n && <p className="text-xs text-amber-800 mt-2">Elegí una y después pulsá <b>Continuar</b> arriba.</p>}
                      </div>
                    ))}

                    {isOpen && (
                      <>
                        {ep.errors?.length > 0 && (
                          <div className="bg-red-50 rounded-xl p-3 space-y-1">
                            {ep.errors.map((e, i) => <p key={i} className="text-xs text-red-700" dir="auto">{e}</p>)}
                          </div>
                        )}
                        {ep.joinNote && <p className="text-xs text-slate-500" dir="auto">{ep.joinNote}</p>}
                        {ep.dlNote && <p className="text-xs text-slate-500" dir="auto">{ep.dlNote}</p>}
                        {ep.projectId && !here && (
                          <Btn disabled={!canRun} onClick={() => run('open_project', ep)} className="w-full"><FolderOpen size={15} /> Abrir su proyecto en Flow</Btn>
                        )}
                        <Btn kind="primary" disabled={!canRun || !ep.imgs.total} onClick={() => run('run_all', ep)} className="w-full"><Play size={15} /> Hacer todo: imágenes y luego videos</Btn>
                        <div className="grid grid-cols-2 gap-2">
                          <Btn disabled={!canRun || !ep.imgs.total} onClick={() => run('run_images', ep)}><ImageIcon size={15} /> ① Imágenes</Btn>
                          <Btn disabled={!canRun || !ep.imgs.done} onClick={() => run('run_videos', ep)}><Film size={15} /> ③ Videos</Btn>
                          <Btn disabled={!canRun || ep.vids.done < 2} onClick={() => run('join', ep)}><Clapperboard size={15} /> Unir</Btn>
                          <Btn disabled={!canRun || !(ep.imgs.done || ep.vids.done)} onClick={() => run('download', ep)}><Download size={15} /> Descargar</Btn>
                        </div>
                        {ep.projectId && !here && <p className="text-[11px] text-slate-400" dir="auto">Para crear, unir o descargar, primero abrí su proyecto ("{ep.projectName}").</p>}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {online && st.log?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Últimas órdenes</p>
              {st.log.slice().reverse().map((l, i) => <p key={i} className="text-xs text-slate-600 py-0.5" dir="auto">{l}</p>)}
            </div>
          )}
        </>
      )}

      {/* La pregunta de la extensión antes de empezar (costo, etc.) */}
      {ask && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={() => setAsk(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-slate-800">La extensión pregunta</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap" dir="auto">{ask.text.replace(/^❓ /gm, '')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Btn onClick={() => setAsk(null)}>Cancelar</Btn>
              <Btn kind="primary" onClick={() => { const a = ask; setAsk(null); send(a.action, { ...a.payload, confirm: true }) }}>Sí, empezar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
