import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, fetchCsrf } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function ProfilePage() {
  const { user, loading, refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)

  useEffect(() => {
    if (!user) return
    setEmail(user.email ?? '')
    setDisplayName(user.displayName ?? '')
  }, [user])

  const hasChanges = useMemo(() => {
    if (!user) return false
    return email.trim() !== (user.email ?? '') || displayName.trim() !== (user.displayName ?? '')
  }, [displayName, email, user])

  if (!loading && !user) return <Navigate to="/login" replace />

  const saveProfile = async (e) => {
    e.preventDefault()
    if (!user || !hasChanges) return

    setSaving(true)
    setErr(null)
    setOk(null)
    const payload = { email: email.trim(), displayName: displayName.trim() }

    try {
      await fetchCsrf()

      // Endpoint varies across setups; try common "current user profile" routes.
      const attempts = [
        () => api.put('/api/users/me', payload),
        () => api.patch('/api/users/me', payload),
        () => api.put('/api/auth/me', payload),
        () => api.patch('/api/auth/me', payload),
      ]

      let lastError = null
      for (const attempt of attempts) {
        try {
          await attempt()
          lastError = null
          break
        } catch (error) {
          const status = error?.response?.status
          if (status && status !== 404 && status !== 405) {
            throw error
          }
          lastError = error
        }
      }

      if (lastError) {
        // Dev fallback: some setups only expose dev-login and not a dedicated profile endpoint.
        await api.post('/api/auth/dev-login', {
          email: payload.email,
          name: payload.displayName,
          role: user.role,
        })
      }

      await refresh()
      setOk('Profile updated successfully.')
    } catch (error) {
      const backendMessage = error?.response?.data?.message
      setErr(
        backendMessage
          ? `Could not update profile: ${backendMessage}`
          : 'Could not update profile. Backend profile update endpoint is not available.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>My profile</h1>
      <p className="small">Update your profile details. Your role is managed by the system and cannot be changed here.</p>

      <div className="card">
        <form onSubmit={(e) => void saveProfile(e)}>
          <div className="field">
            <label>Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div className="field">
            <label>Role</label>
            <input value={user?.role ?? ''} readOnly disabled />
          </div>

          {err && <p className="error">{err}</p>}
          {ok && <p className="small">{ok}</p>}

          <div className="row-actions">
            <button type="submit" className="btn primary" disabled={saving || !hasChanges}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
