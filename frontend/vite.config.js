import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function backendProxy(target) {
  return {
    target,
    changeOrigin: false,
    secure: false,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq, req) => {
        const host = req.headers.host
        if (host) {
          proxyReq.setHeader('X-Forwarded-Host', host)
          proxyReq.setHeader('X-Forwarded-Proto', req.headers['x-forwarded-proto'] || 'http')
        }
      })
      proxy.on('error', (err, _req, res) => {
        // Typical cause: API not running → browser shows generic "HTTP ERROR 502"
        console.error(`[vite proxy] ${target} unreachable:`, err.message)
        if (res && !res.headersSent && typeof res.writeHead === 'function') {
          res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(
            `<!doctype html><html><body style="font-family:system-ui;padding:2rem;max-width:40rem">` +
              `<h1>API not reachable</h1>` +
              `<p>The dev server proxies API traffic to <strong>${target}</strong>, but nothing answered (connection refused or reset).</p>` +
              `<p><strong>Fix:</strong> start the Spring Boot backend on that port first, e.g. from the <code>backend</code> folder run <code>.\\start-postgres.ps1</code> or <code>mvn spring-boot:run</code>, then refresh.</p>` +
              `<p>If your API uses another port, set <code>VITE_DEV_PROXY_TARGET</code> in <code>frontend/.env.development</code> to match (e.g. <code>http://localhost:8080</code>).</p>` +
              `</body></html>`
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8081'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        // Same-origin in dev so session + CSRF cookies work after Google OAuth (see README).
        '/api': backendProxy(proxyTarget),
        '/oauth2': backendProxy(proxyTarget),
        '/login': backendProxy(proxyTarget),
      },
    },
  }
})
