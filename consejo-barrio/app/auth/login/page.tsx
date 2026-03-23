'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ORGS, ROLE_LABELS, getOrg } from '@/types'

const ALL_ROLES = [
  { group: 'Obispado', roles: ['obispo','c1_ob','c2_ob','sec_ej','sec_ba'] },
  { group: 'Cuórum de Élderes', roles: ['pres_cu','c1_cu','c2_cu','sec_cu'] },
  { group: 'Sociedad de Socorro', roles: ['pres_sr','c1_sr','c2_sr','sec_sr'] },
  { group: 'Mujeres Jóvenes', roles: ['pres_mj','c1_mj','c2_mj','sec_mj'] },
  { group: 'Sacerdocio Aarónico', roles: ['ayud_pr','pres_ma','pres_di'] },
  { group: 'Primaria', roles: ['pres_pm','c1_pm','sec_pm'] },
]

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Register
  const [name, setName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [role, setRole] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !regEmail || !regPassword || !role) { setError('Completa todos los campos.'); return }
    if (regPassword.length < 6) { setError('La contraseña debe tener mínimo 6 caracteres.'); return }
    setLoading(true); setError('')
    const org = getOrg(role)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: { data: { name, role, org_id: org.id } }
    })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, name, role, org_id: org.id
      })
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy to-[#2a4d9e] p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="bg-white rounded-2xl p-10 w-full max-w-md relative z-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl text-gold mb-3">✝</div>
          <h1 className="font-serif text-2xl text-navy font-semibold leading-tight">Consejo de Barrio</h1>
          <p className="text-xs text-gray-400 mt-1">La Iglesia de Jesucristo de los Santos de los Últimos Días</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-5">{error}</div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input className="input" type="email" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-navy w-full justify-center py-3 text-base mt-2" type="submit" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" type="text" placeholder="Ej: Hermana Martínez" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Correo</label>
              <input className="input" type="email" placeholder="tu@correo.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
            </div>
            <div>
              <label className="label">Llamamiento</label>
              <select className="input" value={role} onChange={e => setRole(e.target.value)} required>
                <option value="">— Selecciona tu llamamiento —</option>
                {ALL_ROLES.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <button className="btn btn-navy w-full justify-center py-3 text-base mt-2" type="submit" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-400 mt-6">
          {mode === 'login' ? '¿Sin cuenta? ' : '¿Ya tienes cuenta? '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} className="text-gold font-bold hover:underline">
            {mode === 'login' ? 'Regístrate aquí' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
