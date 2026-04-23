import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, fetchCsrf, getOAuthAuthorizationUrl } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { HiOutlineArrowRightCircle, HiOutlineKey, HiOutlineSparkles } from 'react-icons/hi2'

export function LoginPage() {
  const { user, refresh } = useAuth()
  const [email, setEmail] = useState('student@campus.local')
  const [name, setName] = useState('Demo Student')
  const [role, setRole] = useState('USER')
  const [err, setErr] = useState(null)
  const [googleConfigured, setGoogleConfigured] = useState(true)

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const { data } = await api.get('/api/auth/providers')
        setGoogleConfigured(Boolean(data?.googleConfigured))
      } catch {
        // Keep existing behavior if provider metadata cannot be fetched.
        setGoogleConfigured(true)
      }
    }
    void loadProviders()
  }, [])

  if (user) return <Navigate to="/" replace />

  const google = () => {
    if (!googleConfigured) {
      setErr('Google OAuth is not configured on the API. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then restart backend.')
      return
    }
    window.location.href = getOAuthAuthorizationUrl()
  }

  const devLogin = async (e) => {
    e.preventDefault()
    setErr(null)
    try {
      await fetchCsrf()
      await api.post('/api/auth/dev-login', { email, name, role })
      await refresh()
    } catch (error) {
      const status = error?.response?.status
      const backendMessage = error?.response?.data?.message

      if (status === 404) {
        setErr('Dev login endpoint not available. Start API with profile "dev" (or "postgres,dev").')
        return
      }
      if (status === 403) {
        setErr('Dev login blocked by CSRF/session mismatch. Refresh the page and try again.')
        return
      }

      setErr(
        backendMessage
          ? `Dev login failed: ${backendMessage}`
          : 'Dev login failed. Check API URL/profile and try again.'
      )
    }
  }

  const showDev = import.meta.env.DEV

  return (
    <div style={{ maxWidth: 440 }}>
      <section className="hero-card rainbow mb-6">
        <div className="relative z-10">
          <p className="glass-chip">Welcome</p>
          <h1 className="mt-3 gradient-title">Smart Campus Access Portal</h1>
          <p className="small">
            Secure sign-in with Google OAuth and role-based access to bookings, maintenance, and
            notifications.
          </p>
        </div>
      </section>

      <h1 className="flex items-center gap-2">
        <HiOutlineKey className="text-cyan-300" />
        Sign in
      </h1>
      <p className="small">OAuth 2.0 with Google (production), or local dev accounts.</p>
      <div className="card stack">
        <button type="button" className="btn primary" onClick={google} disabled={!googleConfigured}>
          <HiOutlineArrowRightCircle />
          Continue with Google
        </button>
        <p className="small">
          Configure <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> on the API.
        </p>
        {!googleConfigured && (
          <p className="error">
            Google OAuth is currently disabled because the client credentials are missing or still set to placeholders.
          </p>
        )}
      </div>
      {showDev && (
        <div className="card">
          <h2 className="flex items-center gap-2">
            <HiOutlineSparkles className="text-violet-300" />
            Development login
          </h2>
          <p className="small">Start API with: mvn spring-boot:run -Dspring-boot.run.profiles=dev</p>
          <form onSubmit={(e) => void devLogin(e)}>
            <div className="field">
              <label>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
            </div>
            <div className="field">
              <label>Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="TECHNICIAN">TECHNICIAN</option>
              </select>
            </div>
            {err && <p className="error">{err}</p>}
            <button type="submit" className="btn primary">
              Dev sign-in
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
