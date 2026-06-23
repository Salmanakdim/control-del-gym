import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Dumbbell, Eye, EyeOff } from 'lucide-react'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'register') {
        const result = await signUp(email, password, name)
        console.log('signUp result:', JSON.stringify(result))
        if (result.error) setError(result.error.message || result.error.code || JSON.stringify(result.error))
        else {
          const loginResult = await signIn(email, password)
          if (loginResult.error) setSuccess('Cuenta creada. Ya puedes iniciar sesión.')
        }
      } else {
        const result = await signIn(email, password)
        console.log('signIn result:', JSON.stringify(result))
        if (result.error) setError(result.error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : result.error.message || result.error.code || JSON.stringify(result.error))
      }
    } catch (e) {
      console.log('catch error:', e)
      setError(e.message || 'Error de conexión')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Dumbbell size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">IronFlow</h1>
          <p className="text-slate-400 mt-1 text-sm">Tu entrenamiento, tu progreso</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 pr-12"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? (
              <>¿No tienes cuenta?{' '}
                <button onClick={() => { setMode('register'); setError(''); setSuccess('') }}
                  className="text-blue-600 font-semibold hover:underline">
                  Regístrate gratis
                </button>
              </>
            ) : (
              <>¿Ya tienes cuenta?{' '}
                <button onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                  className="text-blue-600 font-semibold hover:underline">
                  Inicia sesión
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
