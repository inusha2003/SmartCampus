import axios from 'axios'

const raw = import.meta.env.VITE_API_URL
const trimmed = typeof raw === 'string' ? raw.trim() : ''

let baseURL
if (trimmed !== '') {
  baseURL = trimmed.replace(/\/$/, '')
} else if (import.meta.env.DEV) {
  // Vite proxy: requests stay on the dev-server origin so session cookies match OAuth callback.
  baseURL = ''
} else {
  baseURL = 'http://localhost:8080'
}

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Use this for Google OAuth start URL. In dev (proxy mode) the browser must hit the SPA origin
 * so the OAuth redirect_uri is localhost:5173 and Set-Cookie applies to the same site as /api.
 */
export function getOAuthAuthorizationUrl() {
  if (trimmed !== '') {
    return `${baseURL}/oauth2/authorization/google`
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/oauth2/authorization/google`
  }
  return '/oauth2/authorization/google'
}

let csrfToken = null
let csrfHeader = 'X-XSRF-TOKEN'

export async function fetchCsrf() {
  const { data } = await api.get('/api/auth/csrf')
  csrfToken = data.token || null
  if (data.headerName) csrfHeader = data.headerName
}

api.interceptors.request.use(async (config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  const m = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(m)) {
    if (!csrfToken) {
      await fetchCsrf()
    }
    if (csrfToken) {
      config.headers = config.headers || {}
      config.headers[csrfHeader] = csrfToken
    }
  }
  return config
})

export function resetCsrf() {
  csrfToken = null
}

/**
 * URL for viewing a ticket attachment (for `<img src>` etc.). Uses API base when set so images work
 * when the SPA and API are on different origins.
 */
export function ticketAttachmentDownloadUrl(ticketId, attachmentId) {
  const path = `/api/tickets/${ticketId}/attachments/${attachmentId}/download`
  const b = api.defaults.baseURL
  if (typeof b === 'string' && b.length > 0) {
    return `${b.replace(/\/$/, '')}${path}`
  }
  return path
}

/** Before/after settlement photos for a ticket (`<img src>` with session cookies). */
export function ticketSettlementDownloadUrl(ticketId, which) {
  const slot = which === 'before' ? 'before' : 'after'
  const path = `/api/tickets/${ticketId}/settlement/${slot}/download`
  const b = api.defaults.baseURL
  if (typeof b === 'string' && b.length > 0) {
    return `${b.replace(/\/$/, '')}${path}`
  }
  return path
}
