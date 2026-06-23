import { LayoutDashboard, ClipboardList, Dumbbell, TrendingUp, Menu, X, BookOpen } from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',              Icon: LayoutDashboard },
  { id: 'routines',   label: 'Rutinas',                Icon: ClipboardList },
  { id: 'log',        label: 'Entrenamiento',          Icon: Dumbbell },
  { id: 'exercises',  label: 'Ejercicios',             Icon: BookOpen },
  { id: 'progress',   label: 'Progreso',               Icon: TrendingUp },
]

export default function Sidebar({ page, setPage }) {
  const [open, setOpen] = useState(false)

  const navItems = (
    <nav className="flex flex-col gap-1 mt-6">
      {NAV.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => { setPage(id); setOpen(false) }}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors w-full text-left
            ${page === id
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <Icon size={18} />
          {label}
        </button>
      ))}
    </nav>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-40 flex flex-col p-4
        transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:h-screen lg:flex
      `}>
        <div className="flex items-center gap-2 px-2 py-4 border-b border-slate-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Dumbbell size={16} className="text-white" />
          </div>
          <span className="font-bold text-slate-800 text-lg">GymControl</span>
        </div>
        {navItems}
      </aside>
    </>
  )
}
