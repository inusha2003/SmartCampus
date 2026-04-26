import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { api, fetchCsrf, getOAuthAuthorizationUrl } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  HiOutlineEnvelope,
  HiOutlineEyeSlash,
  HiOutlineSparkles,
} from 'react-icons/hi2'
import { FaGoogle } from 'react-icons/fa6'

export function LoginPage() {
  const { user, refresh } = useAuth()
  const [searchParams] = useSearchParams()
  const oauthReturnFailed = searchParams.get('from') === 'oauth'
  const [email, setEmail] = useState('student@campus.local')
  const [name, setName] = useState('Demo Student')
  const [role, setRole] = useState('USER')
  const [rememberMe, setRememberMe] = useState(true)
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const [googleConfigured, setGoogleConfigured] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)

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

  const credentialLogin = async (e) => {
    e.preventDefault()
    setErr(null)
    const emailValue = email.trim()
    if (!emailValue || !password) {
      setErr('Email and password are required.')
      return
    }

    setLoggingIn(true)
    const payload = { email: emailValue, username: emailValue, password, rememberMe }
    const attempts = [
      () => api.post('/api/auth/login', payload),
      () => api.post('/api/auth/login', { username: emailValue, password, rememberMe }),
      () => api.post('/api/auth/signin', payload),
      () => api.post('/api/auth/signin', { username: emailValue, password, rememberMe }),
      () => api.post('/api/login', payload),
      () => api.post('/api/login', { username: emailValue, password, rememberMe }),
      () => api.post('/login', payload),
      () =>
        api.post(
          '/login',
          new URLSearchParams({ username: emailValue, password }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        ),
    ]

    let ok = false
    for (const attempt of attempts) {
      try {
        await fetchCsrf()
        await attempt()
        ok = true
        break
      } catch {
        // try next endpoint
      }
    }
    if (!ok) {
      setErr('Email/password login failed. Check credentials or backend auth endpoint.')
      setLoggingIn(false)
      return
    }
    await refresh()
    setLoggingIn(false)
  }

  const showDev = import.meta.env.DEV

  const loginCard = (
    <section className="auth-card">
      <div className="auth-header">
        <p className="auth-brand">Smart Campus Hub</p>
        <h1 className="auth-title">Log in to your account</h1>
        <p className="small">Welcome back! Select your preferred sign-in method.</p>
      </div>

      <div className="auth-social-grid">
        <button type="button" className="auth-social-btn" onClick={google} disabled={!googleConfigured}>
          <FaGoogle />
          <span>Google</span>
        </button>
      </div>

      <div className="auth-divider">
        <span>or continue with email</span>
      </div>

      <form onSubmit={(e) => void credentialLogin(e)}>
        <div className="auth-input">
          <HiOutlineEnvelope />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
          />
        </div>
        <div className="auth-input">
          <HiOutlineEyeSlash />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
          />
        </div>

        <div className="auth-meta-row">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <button type="button" className="auth-link-btn">
            Forgot Password?
          </button>
        </div>

        <button type="submit" className="btn primary auth-submit" disabled={loggingIn}>
          {loggingIn ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="small">
        New here? <Link to="/signup">Create an account</Link>
      </p>

      {!googleConfigured && (
        <p className="error">
          Google OAuth is currently disabled because the client credentials are missing or still set to placeholders.
        </p>
      )}
      {oauthReturnFailed && (
        <p className="error">
          Google sign-in could not attach a session to this browser. Open the app at{' '}
          <strong>http://localhost:5173</strong>, add{' '}
          <code>http://localhost:5173/login/oauth2/code/google</code> in Google Cloud Console, keep{' '}
          <code>VITE_API_URL</code> empty in dev, and set <code>VITE_DEV_PROXY_TARGET</code> to the{' '}
          <strong>exact</strong> URL where Spring Boot is listening (often <code>http://localhost:8080</code> — if
          your API uses another port, both sides must match or <code>/api/auth/me</code> will fail and you will see this
          message).
        </p>
      )}
    </section>
  )

  const devLoginCard = (
    <section className="auth-card">
      <div className="auth-header">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#d4e2ff]">
          <HiOutlineSparkles className="text-violet-300" aria-hidden />
          Development login
        </h2>
        <p className="small">Start API with: mvn spring-boot:run -Dspring-boot.run.profiles=dev</p>
      </div>
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
        <button type="submit" className="btn primary auth-submit">
          Dev sign-in
        </button>
      </form>
    </section>
  )

  return (
    <div className={showDev ? 'auth-shell login-dev-layout' : 'auth-shell split'}>
      {showDev ? (
        <div className="auth-login-dev-row">
          {loginCard}
          {devLoginCard}
        </div>
      ) : (
        loginCard
      )}
      <section className="auth-card secondary">
        <div className="auth-header">
          <p className="auth-brand">New to Smart Campus?</p>
          <h1 className="auth-title">Create your account</h1>
          <p className="small">
            Sign up once and get role-based access to dashboards, bookings, and ticket workflows.
          </p>
        </div>
        <div className="stack">
          <Link to="/signup" className="btn primary auth-submit">
            Go to sign up
          </Link>
          <p className="small">Use Google in production, or development signup in local mode.</p>
        </div>
      </section>
    </div>
  )
}
