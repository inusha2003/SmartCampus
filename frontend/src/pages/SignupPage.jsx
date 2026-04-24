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
    <div className="auth-shell">
      <section className="auth-card">
        <div className="auth-header">
          <p className="auth-brand">Smart Campus Hub</p>
          <h1 className="auth-title">Create your account</h1>
          <p className="small">
            {showDev
              ? 'Join with Google, or create a local user with the dev auth endpoint below.'
              : 'Use Google to sign up. Your profile is created automatically on first login.'}
          </p>
        </div>

        <div className="auth-social-grid">
          <button type="button" className="auth-social-btn" onClick={googleSignup}>
            <FaGoogle />
            <span>Google</span>
          </button>
        </div>

        {!showDev && (
          <p className="small mt-4">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        )}

        {showDev && (
          <>
            <div className="auth-divider">
              <span>Local development</span>
            </div>
            <h2 className="mb-2 mt-1 flex items-center gap-2 text-lg font-semibold text-[#d4e2ff]">
              <HiOutlineSparkles className="text-violet-300" aria-hidden />
              Development signup
            </h2>
            <p className="small mb-4">
              Creates a local USER account via <code className="text-xs">/api/auth/dev-login</code>. Start the API
              with profile <code className="text-xs">dev</code> when using this.
            </p>
            <form onSubmit={(e) => void devSignup(e)}>
              <div className="auth-input">
                <HiOutlineEnvelope />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@campus.local"
                  aria-label="Email"
                />
              </div>
              <div className="auth-input">
                <HiOutlineUserPlus />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Display name"
                  aria-label="Display name"
                />
              </div>
              {err && <p className="error">{err}</p>}
              <button type="submit" className="btn primary auth-submit" disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
            <p className="small mt-4">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </section>
    </div>
  )
}
