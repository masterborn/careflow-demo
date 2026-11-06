import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api, type User } from './api.ts'
import Layout from './components/Layout.tsx'
import Login from './pages/Login.tsx'
import PatientHome from './pages/PatientHome.tsx'
import ClinicianHome from './pages/ClinicianHome.tsx'
import AdminHome from './pages/AdminHome.tsx'
import RequestDetail from './pages/RequestDetail.tsx'
import NotFound from './pages/NotFound.tsx'

interface AuthCtx {
  user: User | null
  setUser: (u: User | null) => void
}
const AuthContext = createContext<AuthCtx>({ user: null, setUser: () => {} })
export const useAuth = () => useContext(AuthContext)

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Layout>{children}</Layout>
}

function Home() {
  const { user } = useAuth()
  if (user?.role === 'patient') return <PatientHome />
  if (user?.role === 'clinician') return <ClinicianHome />
  return <AdminHome />
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    api<{ user: User }>('/api/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setChecked(true))
  }, [])

  useEffect(() => {
    document.body.dataset.role = user?.role ?? 'guest'
    if (checked) document.title = user ? `CareFlow · ${user.title}` : 'CareFlow · Sign in'
  }, [user, checked])

  if (!checked) return <div className="boot">Loading CareFlow…</div>

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/requests/:id" element={<RequireAuth><RequestDetail /></RequireAuth>} />
        <Route path="*" element={<RequireAuth><NotFound /></RequireAuth>} />
      </Routes>
    </AuthContext.Provider>
  )
}
