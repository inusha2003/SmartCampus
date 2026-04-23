import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { HiOutlineEnvelope, HiOutlineSparkles, HiOutlineUserPlus } from 'react-icons/hi2'
import { FaGoogle } from 'react-icons/fa6'
import { api, fetchCsrf, getOAuthAuthorizationUrl } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function SignupPage() {
  const { user, refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const showDev = import.meta.env.DEV

  const googleSignup = () => {
    window.location.href = getOAuthAuthorizationUrl()
  }

  const devSignup = async (e) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await fetchCsrf()
      await api.post('/api/auth/dev-login', {
        email,
        name,
        role: 'USER',
      })
      await refresh()
    } catch (error) {
      const status = error?.response?.status
      const backendMessage = error?.response?.data?.message

      if (status === 404) {
        setErr('Signup endpoint is not available. Start backend with profile "dev".')
      } else if (status === 403) {
        setErr('Signup blocked by CSRF/session mismatch. Refresh and try again.')
      } else {
        setErr(backendMessage ? `Signup failed: ${backendMessage}` : 'Signup failed. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={showDev ? 'auth-shell split' : 'auth-shell'}>
      <section className="auth-card">
        <div className="auth-header">
          <p className="auth-brand">Smart Campus Hub</p>
          <h1 className="auth-title">Create your account</h1>
          <p className="small">Join with Google, or create a local development account.</p>
        </div>

        <div className="auth-social-grid">
          <button type="button" className="auth-social-btn" onClick={googleSignup}>
            <FaGoogle />
            <span>Google</span>
          </button>
        </div>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <div className="auth-input">
          <HiOutlineEnvelope />
          <input type="email" value={email} readOnly placeholder="Email" aria-label="Email" />
        </div>
        <div className="auth-input">
          <HiOutlineUserPlus />
          <input type="text" value={name} readOnly placeholder="Display name" aria-label="Display name" />
        </div>

        <button type="button" className="btn primary auth-submit" onClick={googleSignup}>
          Sign up
        </button>

        <p className="small">Use this in production. Your profile is created automatically on first login.</p>
        <p className="small">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>

      {showDev && (
        <div className="card" style={{ marginBottom: 0 }}>
          <h2>Development signup</h2>
          <p className="small">Creates a local USER account using the dev auth endpoint.</p>
          <form onSubmit={(e) => void devSignup(e)}>
            <div className="field">
              <label>Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                placeholder="you@campus.local"
              />
            </div>
            <div className="field">
              <label>Display name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
              />
            </div>
            {err && <p className="error">{err}</p>}
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
