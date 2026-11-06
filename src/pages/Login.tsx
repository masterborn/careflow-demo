import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, type User } from '../api.ts'
import { useAuth } from '../App.tsx'

export default function Login() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { user } = await api<{ user: User }>('/api/login', { method: 'POST', body: { email, password } })
      setUser(user)
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit} data-testid="login-form">
        <div className="brand big"><span className="brand-mark" aria-hidden>+</span> CareFlow</div>
        <h1>Sign in</h1>
        <p className="muted">Patients, clinicians and administrators all sign in here.</p>
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-testid="login-email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            data-testid="login-password"
          />
        </label>
        {error && <p className="error" role="alert" data-testid="login-error">{error}</p>}
        <button className="btn primary wide" type="submit" disabled={busy} data-testid="login-submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
