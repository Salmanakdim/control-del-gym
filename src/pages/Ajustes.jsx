import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Check, LogOut, Bell, Pencil, X,
  Crown, Shield, Mail, Star, Trash2, ChevronRight
} from 'lucide-react'
import { getDailyNotifPrefs, saveDailyNotifPrefs, scheduleDailyNotifications, cancelDailyNotifications } from '../lib/notifications'

const SUPPORT_EMAIL = 'soporte@flowlyday.com'
const PRIVACY_URL   = 'https://flowlyday.com/privacidad'

function fmtTime(h, m) {
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

const NOTIF_ITEMS = [
  { key: 'metas',                label: '🎯 Mis Metas',           desc: 'Recordatorio para escribir tus metas' },
  { key: 'habitos',              label: '🔥 Hábitos',             desc: 'Recordatorio para completar tus hábitos' },
  { key: 'afirmaciones_morning', label: '✨ Afirmaciones mañana', desc: 'Sesión de afirmaciones matutina' },
  { key: 'afirmaciones_evening', label: '🌙 Afirmaciones noche',  desc: 'Sesión de afirmaciones nocturna' },
]

function Toggle({ on, onToggle }) {
  return (
    <button onClick={onToggle}
      className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${on ? 'bg-blue-600' : 'bg-slate-200'}`}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}/>
    </button>
  )
}

function SectionLabel({ children }) {
  return <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4 pt-4 pb-2">{children}</p>
}

function RowLink({ icon: Icon, label, desc, onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-slate-50
        ${danger ? 'text-red-500' : 'text-slate-700'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
        ${danger ? 'bg-red-50' : 'bg-slate-100'}`}>
        <Icon size={16} className={danger ? 'text-red-500' : 'text-slate-500'}/>
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-semibold ${danger ? 'text-red-500' : 'text-slate-700'}`}>{label}</p>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      <ChevronRight size={16} className="text-slate-300 flex-shrink-0"/>
    </button>
  )
}

export default function Ajustes() {
  const { user, signOut } = useAuth()

  const initial = (user?.user_metadata?.name || user?.email || '?').charAt(0).toUpperCase()

  const [editingName, setEditingName] = useState(false)
  const [name,        setName]        = useState(user?.user_metadata?.name || '')
  const [nameSaved,   setNameSaved]   = useState(false)

  const [prefs,       setPrefs]       = useState(getDailyNotifPrefs())
  const [notifSaved,  setNotifSaved]  = useState(false)
  const [savingNotif, setSavingNotif] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting,        setDeleting]        = useState(false)
  const [deleteConfirm,   setDeleteConfirm]   = useState('')

  async function saveName() {
    if (!name.trim()) return
    await supabase.auth.updateUser({ data: { name: name.trim() } })
    setEditingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2500)
  }

  function toggleNotif(key) {
    setPrefs(p => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }))
  }
  function setTime(key, value) {
    const [h, m] = value.split(':').map(Number)
    setPrefs(p => ({ ...p, [key]: { ...p[key], hour: h, minute: m } }))
  }
  async function saveNotifications() {
    setSavingNotif(true)
    saveDailyNotifPrefs(prefs)
    const anyEnabled = Object.values(prefs).some(p => p.enabled)
    if (anyEnabled) await scheduleDailyNotifications()
    else await cancelDailyNotifications()
    setSavingNotif(false)
    setNotifSaved(true)
    setTimeout(() => setNotifSaved(false), 2000)
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      await supabase.rpc('delete_user')
    } catch {}
    await signOut()
  }

  function openPrivacy() {
    window.open(PRIVACY_URL, '_blank')
  }
  function openSupport() {
    window.open(`mailto:${SUPPORT_EMAIL}?subject=Soporte Flowlyday`, '_blank')
  }
  function openRating() {
    window.open('https://play.google.com/store/apps/details?id=com.flowlyday.app', '_blank')
  }

  return (
    <div className="space-y-5 max-w-lg pb-8">

      <h1 className="text-2xl font-black text-slate-800">Ajustes</h1>

      {/* ── Perfil card ── */}
      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 border-white/30">
            <span className="text-2xl font-black text-white">{initial}</span>
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                placeholder="Tu nombre"
                className="bg-white/20 text-white placeholder-white/50 rounded-xl px-3 py-1.5 text-sm font-bold w-full outline-none border border-white/40"
              />
            ) : (
              <p className="font-black text-lg leading-tight truncate">
                {name || 'Sin nombre'}
                {nameSaved && <span className="text-sm font-normal ml-2 text-green-300">✓ Guardado</span>}
              </p>
            )}
            <p className="text-white/60 text-xs mt-0.5 truncate">{user?.email}</p>
          </div>
          {editingName ? (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setEditingName(false)}
                className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <X size={15} className="text-white"/>
              </button>
              <button onClick={saveName}
                className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
                <Check size={15} className="text-blue-600" strokeWidth={3}/>
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingName(true)}
              className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 active:bg-white/30">
              <Pencil size={15} className="text-white"/>
            </button>
          )}
        </div>
      </div>

      {/* ── Notificaciones ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <SectionLabel>Notificaciones</SectionLabel>
        <div className="divide-y divide-slate-50">
          {NOTIF_ITEMS.map(({ key, label, desc }) => (
            <div key={key} className="px-4 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm font-bold text-slate-700">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Toggle on={prefs[key].enabled} onToggle={() => toggleNotif(key)}/>
              </div>
              {prefs[key].enabled && (
                <div className="mt-3 flex items-center gap-2">
                  <Bell size={14} className="text-slate-400 flex-shrink-0"/>
                  <input type="time"
                    value={fmtTime(prefs[key].hour, prefs[key].minute)}
                    onChange={e => setTime(key, e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 pt-1 pb-4">
          <button onClick={saveNotifications} disabled={savingNotif}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 active:bg-blue-700 flex items-center justify-center gap-2">
            {notifSaved ? <><Check size={15} strokeWidth={3}/> Guardado</> : savingNotif ? 'Guardando...' : 'Guardar notificaciones'}
          </button>
        </div>
      </div>

      {/* ── Suscripción ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <SectionLabel>Suscripción</SectionLabel>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-200 rounded-xl flex items-center justify-center">
                <Crown size={18} className="text-slate-400"/>
              </div>
              <div>
                <p className="text-sm font-black text-slate-700">Plan Gratuito</p>
                <p className="text-xs text-slate-400 mt-0.5">Premium próximamente</p>
              </div>
            </div>
            <span className="text-xs font-bold bg-blue-100 text-blue-600 px-2.5 py-1 rounded-xl">
              Próximo
            </span>
          </div>
        </div>
      </div>

      {/* ── Privacidad y datos ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <SectionLabel>Privacidad y datos</SectionLabel>
        <div className="divide-y divide-slate-50">
          <RowLink icon={Shield} label="Política de privacidad" desc="Ver cómo usamos tus datos" onClick={openPrivacy}/>
          <RowLink icon={Trash2} label="Eliminar mi cuenta" desc="Borra todos tus datos permanentemente" onClick={() => setShowDeleteModal(true)} danger/>
        </div>
      </div>

      {/* ── Soporte ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <SectionLabel>Soporte</SectionLabel>
        <div className="divide-y divide-slate-50">
          <RowLink icon={Mail} label="Contactar soporte" desc={SUPPORT_EMAIL} onClick={openSupport}/>
          <RowLink icon={Star} label="Valorar la app" desc="¿Te gusta Flowlyday? Déjanos una reseña" onClick={openRating}/>
        </div>
      </div>

      {/* ── Cerrar sesión ── */}
      <button onClick={signOut}
        className="w-full py-3.5 bg-white rounded-2xl shadow-sm text-red-500 font-bold text-sm flex items-center justify-center gap-2 active:bg-red-50">
        <LogOut size={16}/> Cerrar sesión
      </button>

      {/* ── Modal eliminar cuenta ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-500"/>
              </div>
              <h3 className="font-black text-slate-800 text-lg">¿Eliminar cuenta?</h3>
              <p className="text-slate-500 text-sm mt-1">
                Se borrarán todos tus datos permanentemente. Esta acción no se puede deshacer.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1.5">Escribe <span className="text-red-500">ELIMINAR</span> para confirmar</p>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="ELIMINAR"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-slate-300"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm">
                Cancelar
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== 'ELIMINAR' || deleting}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl text-sm disabled:opacity-40 active:bg-red-600">
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
