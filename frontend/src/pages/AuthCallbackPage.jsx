import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AuthCallbackPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    void (async () => {
      // Retry while session cookie / CSRF settle after OAuth redirect (especially behind Vite proxy).
      let signedIn = false
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const user = await refresh()
        if (user) {
          signedIn = true
          break
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, 300)
        })
      }

      navigate('/', { replace: true })
      if (!signedIn && import.meta.env.DEV) {
        console.warn(
          '[auth] Session not detected after OAuth. Use http://localhost:5173, set Google redirect URI to ' +
            'http://localhost:5173/login/oauth2/code/google, and keep VITE_API_URL empty in dev (Vite proxy).'
        )
      }
    })()
  }, [refresh, navigate])

  return (
    <div>
      <h1>Signing you in…</h1>
      <p className="small">Completing OAuth session.</p>
    </div>
  )
}
