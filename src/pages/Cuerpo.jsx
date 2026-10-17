import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Edit2, Plus, X, Check } from 'lucide-react'

function todayStr() { return new Date().toISOString().split('T')[0] }

function calcAge(birthDate) {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() - birth.getMonth() < 0 ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

function calcBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null
  return (weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)
}

function bmiInfo(bmi) {
  const b = parseFloat(bmi)
  if (b < 18.5) return { label: 'Bajo peso',   color: '#3b82f6', pct: (b - 10) / (18.5 - 10) * 25 }
  if (b < 25)   return { label: 'Normal',       color: '#16a34a', pct: 25 + (b - 18.5) / (25 - 18.5) * 25 }
  if (b < 30)   return { label: 'Sobrepeso',    color: '#f59e0b', pct: 50 + (b - 25) / (30 - 25) * 25 }
  return           { label: 'Obesidad',         color: '#ef4444', pct: Math.min(75 + (b - 30) / 10 * 25, 99) }
}

function calcTDEE(weightKg, heightCm, age, gender, activityLevel) {
  if (!weightKg || !heightCm || !age || !gender || !activityLevel) return null
  let bmr
  if (gender === 'Masculino') {
    bmr = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
  } else {
    bmr = 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age
  }
  const mult = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, muy_activo: 1.9 }
  return Math.round(bmr * (mult[activityLevel] || 1.55))
}

function WeightChart({ logs, goal }) {
  if (logs.length < 2) return null
  const W = 320, H = 90, P = 10
  const weights = logs.map(l => parseFloat(l.weight_kg))
  let minW = Math.min(...weights) - 0.5
  let maxW = Math.max(...weights) + 0.5
  if (goal) { minW = Math.min(minW, parseFloat(goal) - 0.5); maxW = Math.max(maxW, parseFloat(goal) + 0.5) }
  const range = maxW - minW || 1
  const x = i => P + (i / (logs.length - 1)) * (W - P * 2)
  const y = v => P + (1 - (v - minW) / range) * (H - P * 2)
  const pts = logs.map((l, i) => `${x(i)},${y(l.weight_kg)}`).join(' ')
  const area = `${x(0)},${H} ${pts} ${x(logs.length - 1)},${H}`
  const lastX = x(logs.length - 1)
  const lastY = y(logs[logs.length - 1].weight_kg)

  return (
    <div className="mt-4 -mx-1">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#wg)"/>
        <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"/>
        {goal && (
          <line x1={P} y1={y(parseFloat(goal))} x2={W - P} y2={y(parseFloat(goal))}
            stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="5,4"/>
        )}
        <circle cx={lastX} cy={lastY} r="4" fill="white" stroke="#2563eb" strokeWidth="2.5"/>
        <text x={lastX} y={lastY - 8} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#2563eb">
          {logs[logs.length - 1].weight_kg}
        </text>
      </svg>
      <div className="flex justify-between px-2 mt-0.5">
        <span className="text-[10px] text-slate-400">
          {new Date(logs[0].date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </span>
        <span className="text-[10px] text-slate-400">
          {new Date(logs[logs.length - 1].date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  )
}

const ACTIVITY_LABELS = {
  sedentario: 'Sedentario',
  ligero:     'Ligero (1-3d/sem)',
  moderado:   'Moderado (3-5d/sem)',
  activo:     'Activo (6-7d/sem)',
  muy_activo: 'Muy activo (2x/día)',
}

export default function Cuerpo() {
  const { user } = useAuth()
  const [profile,    setProfile]    = useState(null)
  const [weightLogs, setWeightLogs] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [editMode,   setEditMode]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [form, setForm] = useState({
    height_cm: '', birth_day: '', birth_month: '', birth_year: '', gender: '', weight_goal_kg: '', activity_level: ''
  })
  const [showLog,   setShowLog]   = useState(false)
  const [logWeight, setLogWeight] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: prof }, { data: wl }] = await Promise.all([
      supabase.from('user_profile').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('weight_logs').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(90),
    ])
    setProfile(prof || null)
    setWeightLogs(wl || [])
    if (prof) {
      const [by, bm, bd] = (prof.birth_date || '--').split('-')
      setForm({
        height_cm:      prof.height_cm      || '',
        birth_year:     by && by !== '' ? by : '',
        birth_month:    bm && bm !== '' ? String(parseInt(bm)) : '',
        birth_day:      bd && bd !== '' ? String(parseInt(bd)) : '',
        gender:         prof.gender         || '',
        weight_goal_kg: prof.weight_goal_kg || '',
        activity_level: prof.activity_level || '',
      })
    }
    if (!prof) setEditMode(true)
    setLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    const payload = {
      user_id:        user.id,
      height_cm:      form.height_cm      ? parseInt(form.height_cm)        : null,
      birth_date:     (form.birth_year && form.birth_month && form.birth_day)
        ? `${form.birth_year}-${String(form.birth_month).padStart(2,'0')}-${String(form.birth_day).padStart(2,'0')}`
        : null,
      gender:         form.gender         || null,
      weight_goal_kg: form.weight_goal_kg ? parseFloat(form.weight_goal_kg) : null,
      activity_level: form.activity_level || null,
      updated_at:     new Date().toISOString(),
    }
    const { data } = await supabase.from('user_profile').upsert(payload).select().maybeSingle()
    if (data) setProfile(data)
    setEditMode(false)
    setSaving(false)
  }

  async function logWeightToday() {
    const w = parseFloat(logWeight)
    if (!w || w < 20 || w > 500) return
    const { data } = await supabase.from('weight_logs')
      .upsert({ user_id: user.id, date: todayStr(), weight_kg: w }, { onConflict: 'user_id,date' })
      .select().maybeSingle()
    if (data) {
      setWeightLogs(prev => {
        const rest = prev.filter(l => l.date !== data.date)
        return [data, ...rest].sort((a, b) => b.date.localeCompare(a.date))
      })
    }
    setLogWeight('')
    setShowLog(false)
  }

  async function deleteLog(id) {
    await supabase.from('weight_logs').delete().eq('id', id)
    setWeightLogs(prev => prev.filter(l => l.id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const currentWeight = weightLogs[0]?.weight_kg ? parseFloat(weightLogs[0].weight_kg) : null
  const age           = calcAge(profile?.birth_date ?? null)
  const bmi           = calcBMI(currentWeight, profile?.height_cm)
  const bmiData       = bmi ? bmiInfo(bmi) : null
  const tdee          = calcTDEE(currentWeight, profile?.height_cm, age, profile?.gender, profile?.activity_level)

  const last7  = weightLogs.slice(0, 7)
  const prev7  = weightLogs.slice(7, 14)
  const avg7   = last7.length  ? last7.reduce((s, l)  => s + parseFloat(l.weight_kg), 0) / last7.length  : null
  const avgP7  = prev7.length  ? prev7.reduce((s, l)  => s + parseFloat(l.weight_kg), 0) / prev7.length  : null
  const trend  = avg7 && avgP7 ? (avg7 - avgP7).toFixed(1) : null

  const chartLogs = [...weightLogs].reverse()

  return (
    <div className="space-y-5 max-w-lg pb-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mi cuerpo</h1>
        <p className="text-slate-500 text-sm mt-1">Peso y perfil físico</p>
      </div>

      {/* Top stats */}
      {(currentWeight || bmi || trend !== null) && (
        <div className="grid grid-cols-3 gap-3">
          {currentWeight && (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className="text-2xl font-black text-slate-800">{currentWeight}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">kg · hoy</p>
            </div>
          )}
          {bmiData && (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className="text-2xl font-black" style={{ color: bmiData.color }}>{bmi}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">IMC</p>
            </div>
          )}
          {profile?.weight_goal_kg && currentWeight && (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className="text-2xl font-black text-violet-600">
                {Math.abs(currentWeight - parseFloat(profile.weight_goal_kg)).toFixed(1)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">kg para meta</p>
            </div>
          )}
          {trend !== null && (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className={`text-2xl font-black ${parseFloat(trend) > 0 ? 'text-red-500' : parseFloat(trend) < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                {parseFloat(trend) > 0 ? '+' : ''}{trend}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">tendencia 7d</p>
            </div>
          )}
          {tdee && (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center col-span-3">
              <p className="text-2xl font-black text-orange-500">{tdee}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">kcal mantenimiento / día</p>
            </div>
          )}
        </div>
      )}

      {/* BMI bar */}
      {bmiData && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-slate-800">IMC · {bmi}</p>
            <span className="text-sm font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: bmiData.color }}>{bmiData.label}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden relative"
            style={{ background: 'linear-gradient(to right, #3b82f6 0%, #3b82f6 25%, #16a34a 25%, #16a34a 50%, #f59e0b 50%, #f59e0b 75%, #ef4444 75%)' }}>
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[3px] rounded-full shadow-md"
              style={{ left: `${bmiData.pct}%`, borderColor: bmiData.color, transform: 'translate(-50%,-50%)' }}/>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
            <span>Bajo</span><span>Normal</span><span>Sobrepeso</span><span>Obesidad</span>
          </div>
        </div>
      )}

      {/* Weight log */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-slate-800">Registro de peso</p>
          {!showLog && (
            <button onClick={() => setShowLog(true)}
              className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold active:bg-blue-700">
              <Plus size={12}/> Añadir
            </button>
          )}
        </div>

        {showLog && (
          <div className="flex gap-2 mt-3">
            <input
              autoFocus type="number" value={logWeight}
              onChange={e => setLogWeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && logWeightToday()}
              placeholder="75.5" step="0.1" min="20" max="500"
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="self-center text-slate-500 text-sm font-bold">kg</span>
            <button onClick={logWeightToday}
              className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center active:bg-blue-700">
              <Check size={16}/>
            </button>
            <button onClick={() => { setShowLog(false); setLogWeight('') }}
              className="w-10 h-10 text-slate-400 rounded-xl flex items-center justify-center">
              <X size={16}/>
            </button>
          </div>
        )}

        {chartLogs.length >= 2 && <WeightChart logs={chartLogs} goal={profile?.weight_goal_kg}/>}

        {weightLogs.length === 0 && !showLog && (
          <p className="text-sm text-slate-400 text-center py-4">Aún no hay registros</p>
        )}

        {weightLogs.length > 0 && (
          <div className="mt-4 space-y-0.5 max-h-48 overflow-y-auto">
            {weightLogs.slice(0, 15).map(l => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 group">
                <span className="text-xs text-slate-400">
                  {new Date(l.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-700">{l.weight_kg} kg</span>
                  <button onClick={() => deleteLog(l.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center transition-opacity">
                    <X size={11} className="text-red-400"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-slate-800">Perfil físico</p>
          <button onClick={() => setEditMode(e => !e)}
            className="flex items-center gap-1 text-xs text-blue-600 font-bold active:opacity-70">
            <Edit2 size={12}/> {editMode ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {editMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Altura (cm)</label>
                <input type="number" value={form.height_cm}
                  onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))}
                  placeholder="170"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Fecha de nacimiento</label>
                <div className="flex gap-1.5 items-center">
                  <input type="number" value={form.birth_day} min="1" max="31"
                    onChange={e => setForm(f => ({ ...f, birth_day: e.target.value }))}
                    placeholder="DD"
                    className="w-14 border border-slate-200 rounded-xl px-2 py-2.5 text-sm text-center text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  <span className="text-slate-300 font-bold">/</span>
                  <input type="number" value={form.birth_month} min="1" max="12"
                    onChange={e => setForm(f => ({ ...f, birth_month: e.target.value }))}
                    placeholder="MM"
                    className="w-14 border border-slate-200 rounded-xl px-2 py-2.5 text-sm text-center text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  <span className="text-slate-300 font-bold">/</span>
                  <input type="number" value={form.birth_year} min="1920" max="2025"
                    onChange={e => setForm(f => ({ ...f, birth_year: e.target.value }))}
                    placeholder="AAAA"
                    className="flex-1 border border-slate-200 rounded-xl px-2 py-2.5 text-sm text-center text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Género</label>
              <div className="flex gap-2">
                {['Masculino', 'Femenino', 'Otro'].map(g => (
                  <button key={g} onClick={() => setForm(f => ({ ...f, gender: g }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      form.gender === g
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 text-slate-600 active:bg-slate-50'
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Objetivo de peso (kg)</label>
              <input type="number" value={form.weight_goal_kg}
                onChange={e => setForm(f => ({ ...f, weight_goal_kg: e.target.value }))}
                placeholder="70" step="0.5"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Nivel de actividad</label>
              <div className="space-y-2">
                {[
                  { value: 'sedentario', label: 'Sedentario',  desc: 'Sin ejercicio' },
                  { value: 'ligero',     label: 'Ligero',      desc: '1-3 días/semana' },
                  { value: 'moderado',   label: 'Moderado',    desc: '3-5 días/semana' },
                  { value: 'activo',     label: 'Activo',      desc: '6-7 días/semana' },
                  { value: 'muy_activo', label: 'Muy activo',  desc: '2 veces al día' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(f => ({ ...f, activity_level: opt.value }))}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-colors ${
                      form.activity_level === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 text-slate-700 active:bg-slate-50'
                    }`}>
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className={`text-xs ${form.activity_level === opt.value ? 'text-white/70' : 'text-slate-400'}`}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={saveProfile} disabled={saving}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold disabled:opacity-50 active:bg-blue-700">
              {saving ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </div>
        ) : profile ? (
          <div className="grid grid-cols-2 gap-3">
            {profile.height_cm && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-400 font-medium">Altura</p>
                <p className="text-xl font-black text-slate-800 mt-0.5">{profile.height_cm} <span className="text-sm font-medium text-slate-500">cm</span></p>
              </div>
            )}
            {age !== null && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-400 font-medium">Edad</p>
                <p className="text-xl font-black text-slate-800 mt-0.5">{age} <span className="text-sm font-medium text-slate-500">años</span></p>
              </div>
            )}
            {profile.gender && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-400 font-medium">Género</p>
                <p className="text-xl font-black text-slate-800 mt-0.5">{profile.gender}</p>
              </div>
            )}
            {profile.weight_goal_kg && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-400 font-medium">Objetivo</p>
                <p className="text-xl font-black text-violet-600 mt-0.5">{profile.weight_goal_kg} <span className="text-sm font-medium text-slate-500">kg</span></p>
              </div>
            )}
            {profile.activity_level && (
              <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                <p className="text-[11px] text-slate-400 font-medium">Actividad</p>
                <p className="text-sm font-bold text-slate-700 mt-0.5">{ACTIVITY_LABELS[profile.activity_level]}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-2">Toca "Editar" para añadir tus datos</p>
        )}
      </div>
    </div>
  )
}
