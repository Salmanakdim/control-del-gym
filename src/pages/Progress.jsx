import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { ChevronDown, Trophy } from 'lucide-react'

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h2 className="font-semibold text-slate-700 mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function Progress({ logs }) {
  const exercises = useMemo(() => {
    const names = new Set()
    logs.forEach(l => l.exercises.forEach(ex => names.add(ex.name)))
    return [...names].sort()
  }, [logs])

  const [selectedEx, setSelectedEx] = useState(exercises[0] || '')

  const maxWeightData = useMemo(() => {
    if (!selectedEx) return []
    return logs
      .filter(l => l.exercises.some(ex => ex.name === selectedEx))
      .map(l => {
        const ex = l.exercises.find(e => e.name === selectedEx)
        const maxKg = Math.max(...ex.sets.map(s => s.kg))
        const totalVol = ex.sets.reduce((a, s) => a + s.reps * s.kg, 0)
        return { date: l.date, maxKg, totalVol }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [logs, selectedEx])

  const volumeByDate = useMemo(() => {
    const map = {}
    logs.forEach(l => {
      const vol = l.exercises.reduce((a, ex) =>
        a + ex.sets.reduce((s, set) => s + set.reps * set.kg, 0), 0)
      map[l.date] = (map[l.date] || 0) + vol
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vol]) => ({ date, vol }))
  }, [logs])

  const freqByDay = useMemo(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const count = [0, 0, 0, 0, 0, 0, 0]
    logs.forEach(l => {
      const d = new Date(l.date + 'T12:00:00')
      count[d.getDay()]++
    })
    return days.map((d, i) => ({ day: d, sesiones: count[i] })
    )
  }, [logs])

  const personalRecords = useMemo(() => {
    const map = {}
    logs.forEach(log => {
      log.exercises.forEach(ex => {
        ex.sets.forEach(s => {
          const kg = parseFloat(s.kg) || 0
          if (!map[ex.name] || kg > map[ex.name].kg) {
            map[ex.name] = { kg, reps: parseInt(s.reps) || 0, date: log.date }
          }
        })
      })
    })
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.kg - a.kg)
  }, [logs])

  const muscleVolume = useMemo(() => {
    const map = {}
    logs.forEach(l => l.exercises.forEach(ex => {
      const vol = ex.sets.reduce((a, s) => a + s.reps * s.kg, 0)
      map[ex.muscle] = (map[ex.muscle] || 0) + vol
    }))
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([muscle, vol]) => ({ muscle, vol }))
  }, [logs])

  if (logs.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-lg font-medium">Sin datos aún</p>
        <p className="text-sm mt-1">Registra tu primer entrenamiento para ver el progreso</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Progreso</h1>
        <p className="text-slate-500 text-sm mt-1">Evolución de tus entrenamientos</p>
      </div>

      {/* Personal Records */}
      {personalRecords.length > 0 && (
        <Card title="🏆 Récords personales">
          <div className="space-y-2">
            {personalRecords.slice(0, 10).map((pr, i) => (
              <div key={pr.name} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {i === 0 ? <Trophy size={12} /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{pr.name}</p>
                  <p className="text-xs text-slate-400">{pr.date}</p>
                </div>
                <div className="text-right">
                  <p className={`text-base font-bold ${i === 0 ? 'text-yellow-600' : 'text-slate-700'}`}>{pr.kg} kg</p>
                  <p className="text-xs text-slate-400">{pr.reps} reps</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Exercise progress */}
      <Card title="Progresión de ejercicio">
        <div className="relative mb-4">
          <select
            value={selectedEx}
            onChange={e => setSelectedEx(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            {exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
        </div>

        {maxWeightData.length < 2 ? (
          <p className="text-slate-400 text-sm text-center py-6">Necesitas al menos 2 sesiones con este ejercicio</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={maxWeightData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#cbd5e1" />
              <YAxis tick={{ fontSize: 11 }} stroke="#cbd5e1" unit=" kg" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(v) => [`${v} kg`, 'Máx. peso']}
              />
              <Line type="monotone" dataKey="maxKg" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} name="Máx. peso" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Total volume over time */}
      <Card title="Volumen total por sesión (kg levantados)">
        {volumeByDate.length < 2 ? (
          <p className="text-slate-400 text-sm text-center py-6">Necesitas más sesiones para ver la tendencia</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volumeByDate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#cbd5e1" />
              <YAxis tick={{ fontSize: 11 }} stroke="#cbd5e1" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(v) => [`${v.toLocaleString()} kg`, 'Volumen']}
              />
              <Bar dataKey="vol" fill="#2563eb" radius={[6, 6, 0, 0]} name="Volumen" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Frequency by day */}
        <Card title="Frecuencia por día de la semana">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={freqByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#cbd5e1" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#cbd5e1" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="sesiones" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Volume by muscle */}
        <Card title="Volumen total por músculo">
          {muscleVolume.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Sin datos</p>
          ) : (
            <ul className="space-y-3">
              {muscleVolume.slice(0, 6).map(({ muscle, vol }) => {
                const pct = (vol / muscleVolume[0].vol) * 100
                return (
                  <li key={muscle}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 font-medium">{muscle}</span>
                      <span className="text-slate-400">{vol.toLocaleString()} kg</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
