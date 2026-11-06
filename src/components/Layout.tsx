import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.ts'
import { useAuth } from '../App.tsx'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  async function logout() {
    await api('/api/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="CareFlow home">
          <span className="brand-mark" aria-hidden>+</span> CareFlow
        </Link>
        <div className="who">
          <span className="role-badge" data-testid="role-badge">{user?.title}</span>
          <span className="who-name" data-testid="current-user">{user?.name}</span>
          <button className="btn ghost" onClick={logout} data-testid="logout">Sign out</button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}
