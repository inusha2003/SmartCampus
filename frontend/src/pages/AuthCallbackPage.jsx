import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../auth/roleRouting'

export function AuthCallbackPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Let the browser apply Set-Cookie from the OAuth redirect before the first /api/auth/me.
      await new Promise((resolve) => {
        window.setTimeout(resolve, 250)
      })
      if (cancelled) return
      // Retry while session cookie / CSRF settle after OAuth redirect (especially behind Vite proxy).
      let signedInUser = null
      for (let attempt = 0; attempt < 16; attempt += 1) {
        if (cancelled) return
        const user = await refresh()
        if (user) {
          signedInUser = user
          break
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, 300)
        })
      }

      if (cancelled) return
      if (signedInUser) {
        navigate(getDashboardPath(signedInUser.role), { replace: true })
      } else {
        navigate('/login?from=oauth', { replace: true })
        if (import.meta.env.DEV) {
          console.warn(
            '[auth] Session not detected after OAuth. Use http://localhost:5173, redirect URI ' +
              'http://localhost:5173/login/oauth2/code/google, keep VITE_API_URL unset in dev, ' +
              'and match VITE_DEV_PROXY_TARGET to your API port.'
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, navigate])

  return (
    <div>
      <h1>Signing you in…</h1>
      <p className="small">Completing OAuth session.</p>
    </div>
  )
}
