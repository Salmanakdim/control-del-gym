export { EXERCISES } from '../data/exercises'

export const MUSCLE_COLORS = {
  'Pecho':          { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-200',    gradient: 'from-red-500 to-rose-600' },
  'Espalda':        { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-blue-200',   gradient: 'from-blue-500 to-indigo-600' },
  'Espalda Alta':   { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-blue-200',   gradient: 'from-blue-500 to-indigo-600' },
  'Hombros':        { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', border: 'border-purple-200', gradient: 'from-purple-500 to-violet-600' },
  'Bíceps':         { bg: 'bg-cyan-100',   text: 'text-cyan-700',   dot: 'bg-cyan-500',   border: 'border-cyan-200',   gradient: 'from-cyan-500 to-sky-600' },
  'Tríceps':        { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200', gradient: 'from-orange-500 to-amber-600' },
  'Cuádriceps':     { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  border: 'border-green-200',  gradient: 'from-green-500 to-emerald-600' },
  'Isquiotibiales': { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', border: 'border-yellow-200', gradient: 'from-yellow-500 to-amber-600' },
  'Glúteos':        { bg: 'bg-pink-100',   text: 'text-pink-700',   dot: 'bg-pink-500',   border: 'border-pink-200',   gradient: 'from-pink-500 to-rose-600' },
  'Core':           { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-indigo-200', gradient: 'from-indigo-500 to-purple-600' },
  'Pantorrillas':   { bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500',   border: 'border-teal-200',   gradient: 'from-teal-500 to-cyan-600' },
  'Trapecios':      { bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-500',  border: 'border-slate-200',  gradient: 'from-slate-500 to-slate-600' },
  'Antebrazos':     { bg: 'bg-lime-100',   text: 'text-lime-700',   dot: 'bg-lime-500',   border: 'border-lime-200',   gradient: 'from-lime-500 to-green-600' },
  'Cuello':         { bg: 'bg-rose-100',   text: 'text-rose-700',   dot: 'bg-rose-500',   border: 'border-rose-200',   gradient: 'from-rose-500 to-pink-600' },
  'Cardio':         { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  border: 'border-amber-200',  gradient: 'from-amber-500 to-orange-600' },
}

export const DEFAULT_MUSCLE_COLOR = { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', border: 'border-slate-200', gradient: 'from-slate-500 to-slate-600' }

export const SEED_ROUTINES = [
  {
    id: 'r1',
    name: 'Push (Pecho / Hombros / Tríceps)',
    exercises: [
      { id: 'e1', name: 'Press de Banca (Barra)', muscle: 'Pecho', sets: [{ reps: 10, kg: 60 }, { reps: 8, kg: 65 }, { reps: 6, kg: 70 }, { reps: 6, kg: 70 }] },
      { id: 'e2', name: 'Press Inclinado (Mancuerna)', muscle: 'Pecho', sets: [{ reps: 10, kg: 24 }, { reps: 10, kg: 24 }, { reps: 8, kg: 26 }] },
      { id: 'e3', name: 'Press Militar (Barra)', muscle: 'Hombros', sets: [{ reps: 10, kg: 40 }, { reps: 8, kg: 45 }, { reps: 8, kg: 45 }] },
      { id: 'e4', name: 'Extensiones de Tríceps', muscle: 'Tríceps', sets: [{ reps: 12, kg: 20 }, { reps: 12, kg: 20 }, { reps: 10, kg: 22 }] },
    ],
  },
  {
    id: 'r2',
    name: 'Pull (Espalda / Bíceps)',
    exercises: [
      { id: 'e5', name: 'Remo con Barra', muscle: 'Espalda Alta', sets: [{ reps: 10, kg: 60 }, { reps: 8, kg: 65 }, { reps: 8, kg: 65 }, { reps: 6, kg: 70 }] },
      { id: 'e6', name: 'Dominadas', muscle: 'Espalda', sets: [{ reps: 8, kg: 0 }, { reps: 7, kg: 0 }, { reps: 6, kg: 0 }] },
      { id: 'e7', name: 'Curl de Bíceps (Mancuerna)', muscle: 'Bíceps', sets: [{ reps: 12, kg: 14 }, { reps: 12, kg: 14 }, { reps: 10, kg: 16 }] },
    ],
  },
  {
    id: 'r3',
    name: 'Legs (Piernas)',
    exercises: [
      { id: 'e8', name: 'Sentadilla (Barra)', muscle: 'Cuádriceps', sets: [{ reps: 10, kg: 80 }, { reps: 8, kg: 90 }, { reps: 6, kg: 100 }, { reps: 6, kg: 100 }] },
      { id: 'e9', name: 'Prensa de Piernas', muscle: 'Cuádriceps', sets: [{ reps: 12, kg: 120 }, { reps: 10, kg: 140 }, { reps: 10, kg: 140 }] },
      { id: 'e10', name: 'Curl Femoral', muscle: 'Isquiotibiales', sets: [{ reps: 12, kg: 40 }, { reps: 12, kg: 40 }, { reps: 10, kg: 45 }] },
    ],
  },
]

export const SEED_LOGS = [
  {
    id: 'l1',
    date: '2026-06-19',
    routineId: 'r1',
    routineName: 'Push (Pecho / Hombros / Tríceps)',
    durationMin: 55,
    exercises: [
      { name: 'Press de Banca (Barra)', muscle: 'Pecho', sets: [{ reps: 10, kg: 60 }, { reps: 8, kg: 65 }, { reps: 6, kg: 70 }, { reps: 6, kg: 70 }] },
      { name: 'Press Inclinado (Mancuerna)', muscle: 'Pecho', sets: [{ reps: 10, kg: 24 }, { reps: 10, kg: 24 }, { reps: 8, kg: 26 }] },
    ],
  },
  {
    id: 'l2',
    date: '2026-06-17',
    routineId: 'r2',
    routineName: 'Pull (Espalda / Bíceps)',
    durationMin: 50,
    exercises: [
      { name: 'Remo con Barra', muscle: 'Espalda Alta', sets: [{ reps: 10, kg: 60 }, { reps: 8, kg: 65 }, { reps: 8, kg: 65 }] },
      { name: 'Curl de Bíceps (Mancuerna)', muscle: 'Bíceps', sets: [{ reps: 12, kg: 14 }, { reps: 12, kg: 14 }, { reps: 10, kg: 16 }] },
    ],
  },
  {
    id: 'l3',
    date: '2026-06-15',
    routineId: 'r3',
    routineName: 'Legs (Piernas)',
    durationMin: 60,
    exercises: [
      { name: 'Sentadilla (Barra)', muscle: 'Cuádriceps', sets: [{ reps: 10, kg: 80 }, { reps: 8, kg: 90 }, { reps: 6, kg: 100 }] },
      { name: 'Prensa de Piernas', muscle: 'Cuádriceps', sets: [{ reps: 12, kg: 120 }, { reps: 10, kg: 140 }] },
    ],
  },
  {
    id: 'l4',
    date: '2026-06-12',
    routineId: 'r1',
    routineName: 'Push (Pecho / Hombros / Tríceps)',
    durationMin: 52,
    exercises: [
      { name: 'Press de Banca (Barra)', muscle: 'Pecho', sets: [{ reps: 10, kg: 58 }, { reps: 8, kg: 62 }, { reps: 6, kg: 67 }] },
    ],
  },
  {
    id: 'l5',
    date: '2026-06-10',
    routineId: 'r2',
    routineName: 'Pull (Espalda / Bíceps)',
    durationMin: 48,
    exercises: [
      { name: 'Remo con Barra', muscle: 'Espalda Alta', sets: [{ reps: 10, kg: 55 }, { reps: 8, kg: 60 }, { reps: 8, kg: 60 }] },
    ],
  },
]

export function totalVolume(exercises) {
  return exercises.reduce((acc, ex) =>
    acc + ex.sets.reduce((s, set) => s + set.reps * set.kg, 0), 0)
}

export function uid() {
  return Math.random().toString(36).slice(2, 9)
}
