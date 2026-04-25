import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { HiBell, HiArrowPath } from 'react-icons/hi2'
import { api, ticketAttachmentDownloadUrl } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../auth/roleRouting'
import { TechnicianTechPanelShell } from '../components/TechnicianTechPanelShell'

function formatHeaderDate(d) {
  try {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
    const rest = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${weekday}, ${rest}`
  } catch {
    return ''
  }
}

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

function relativeTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isTodayLocal(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function displayInitial(name, email) {
  const s = (name || email || '?').trim()
  if (!s) return '?'
  return s.charAt(0).toUpperCase()
}

function statusBadgeClass(status) {
  const s = String(status || 'OPEN').toLowerCase()
  return `admin-tickets-status-badge admin-tickets-status-badge--${s}`
}

function isImageAttachment(a) {
  if (a?.contentType && String(a.contentType).startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a?.originalFilename || '')
}

export function TechnicianTasksPage() {
  const { user, loading: authLoading } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [solvingTicketId, setSolvingTicketId] = useState(null)

  const loadTickets = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await api.get('/api/tickets')
      const list = Array.isArray(data) ? data : []
      const assigned = list.filter((t) => Number(t.assignedToId) === Number(user.id))
      setTickets(assigned)
      setLoadError(null)
      setLoadState('ready')
    } catch (e) {
      setLoadError(e?.response?.data?.message || e?.message || 'Could not load tickets.')
      setTickets([])
      setLoadState('error')
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return undefined
    loadTickets()
    const id = window.setInterval(loadTickets, 30_000)
    return () => window.clearInterval(id)
  }, [user?.id, loadTickets])

  const markSolved = useCallback(
    async (ticket) => {
      if (!ticket?.id) return
      setLoadError(null)
      setSolvingTicketId(ticket.id)
      try {
        const existingNotes = String(ticket.resolutionNotes || '').trim()
        await api.put(`/api/tickets/${ticket.id}`, {
          status: 'RESOLVED',
          resolutionNotes:
            existingNotes || 'Resolved by technician. Ready for admin verification and mark as solved.',
          assigneeUserId: ticket.assignedToId ? Number(ticket.assignedToId) : null,
          rejectReason: null,
        })
        await loadTickets()
      } catch (e) {
        setLoadError(e?.response?.data?.message || e?.message || 'Could not mark ticket as solved.')
      } finally {
        setSolvingTicketId(null)
      }
    },
    [loadTickets],
  )

  const kpis = useMemo(() => {
    const inQueue = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length
    const highUrgent = tickets.filter(
      (t) =>
        (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
        (t.priority === 'HIGH' || t.priority === 'URGENT'),
    ).length
    const clearedToday = tickets.filter(
      (t) =>
        (t.status === 'RESOLVED' || t.status === 'CLOSED' || t.status === 'REJECTED') &&
        isTodayLocal(t.updatedAt),
    ).length
    const totalAssigned = tickets.length
    const doneForRate = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length
    const completionRate = totalAssigned > 0 ? Math.round((doneForRate / totalAssigned) * 100) : 0
    return { inQueue, highUrgent, clearedToday, totalAssigned, completionRate }
  }, [tickets])

  const byCategory = useMemo(() => {
    const m = new Map()
    for (const t of tickets) {
      const cat = (t.category && String(t.category).trim()) || 'Uncategorized'
      if (!m.has(cat)) m.set(cat, [])
      m.get(cat).push(t)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const tb = new Date(b.updatedAt || b.createdAt).getTime()
        const ta = new Date(a.updatedAt || a.createdAt).getTime()
        return tb - ta
      })
    }
    return [...m.entries()].sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length
      return a[0].localeCompare(b[0])
    })
  }, [tickets])

  if (authLoading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'TECHNICIAN') return <Navigate to={getDashboardPath(user.role)} replace />

  const initial = displayInitial(user.displayName, user.email)
  const today = formatHeaderDate(new Date())

  return (
    <TechnicianTechPanelShell>
      <header className="tech-panel-header">
        <div>
          <p className="tech-panel-date">{today}</p>
          <h1 className="tech-panel-heading">Tasks</h1>
          <p className="tech-panel-sub">
            Welcome back, <strong>{user.displayName || 'Technician'}</strong>
            <span className="tech-panel-sub-dot"> • </span>
            Track, triage, and close your assigned support tickets.
          </p>
          <p className="tech-panel-live">
            <span className="tech-panel-live-dot" aria-hidden />
            Live sync — refreshes every 30s
          </p>
        </div>
        <div className="tech-panel-header-right">
          <div className="tech-panel-kpi-mini" title="Resolved + closed / assigned">
            <span className="tech-panel-kpi-mini-label">Completion rate</span>
            <span className="tech-panel-kpi-mini-value">{kpis.completionRate}%</span>
          </div>
          <Link to="/notifications" className="tech-panel-icon-btn" aria-label="Notifications">
            <HiBell />
          </Link>
          <div className="tech-panel-avatar" aria-hidden>
            {initial}
          </div>
        </div>
      </header>

      {loadState === 'loading' && <p className="tech-panel-banner small">Loading your queue…</p>}
      {loadState === 'error' && loadError && (
        <p className="tech-panel-banner tech-panel-banner-error small" role="alert">
          {loadError}{' '}
          <button type="button" className="tech-panel-link-btn" onClick={() => void loadTickets()}>
            Retry
          </button>
        </p>
      )}

      <div className="tech-tasks-kpi-row">
        <div className="tech-tasks-kpi tech-tasks-kpi--queue">
          <span className="tech-tasks-kpi-label">In queue</span>
          <span className="tech-tasks-kpi-num">{kpis.inQueue}</span>
          <span className="tech-tasks-kpi-hint">Pending + in progress</span>
        </div>
        <div className="tech-tasks-kpi tech-tasks-kpi--priority">
          <span className="tech-tasks-kpi-label">High + urgent</span>
          <span className="tech-tasks-kpi-num">{kpis.highUrgent}</span>
          <span className="tech-tasks-kpi-hint">Open priority tickets</span>
        </div>
        <div className="tech-tasks-kpi tech-tasks-kpi--cleared">
          <span className="tech-tasks-kpi-label">Cleared today</span>
          <span className="tech-tasks-kpi-num">{kpis.clearedToday}</span>
          <span className="tech-tasks-kpi-hint">Resolved or closed</span>
        </div>
        <div className="tech-tasks-kpi tech-tasks-kpi--total">
          <span className="tech-tasks-kpi-label">Total assigned</span>
          <span className="tech-tasks-kpi-num">{kpis.totalAssigned}</span>
          <span className="tech-tasks-kpi-hint">Assigned to you</span>
        </div>
      </div>

      <section className="tech-tasks-queue-section" aria-label="My queue">
        <div className="tech-tasks-queue-toolbar">
          <div>
            <h2 className="tech-tasks-queue-title">My queue</h2>
            <p className="tech-tasks-queue-sub small">
              Your assigned tickets are grouped by category (admin specialization).
            </p>
          </div>
          <div className="tech-tasks-queue-filters">
            <label className="tech-tasks-filter-label">
              <span className="sr-only">View</span>
              <select className="tech-tasks-select" value="mine" disabled>
                <option value="mine">My assigned tickets</option>
              </select>
            </label>
            <span className="tech-panel-pill">{kpis.totalAssigned} tickets</span>
          </div>
        </div>

        {byCategory.length === 0 && loadState === 'ready' ? (
          <p className="tech-tasks-empty small">
            No tickets assigned to you yet. When an admin assigns work, it will appear here.
          </p>
        ) : null}

        {byCategory.map(([category, list]) => {
          const openN = list.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length
          const urgentN = list.filter(
            (t) =>
              (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
              (t.priority === 'HIGH' || t.priority === 'URGENT'),
          ).length
          return (
            <div key={category} className="tech-tasks-category-block">
              <div className="tech-tasks-category-head">
                <h3 className="tech-tasks-category-title">Assigned category: {category}</h3>
                <div className="tech-tasks-category-badges">
                  <span className="tech-tasks-mini-badge">{openN} open</span>
                  <span className="tech-tasks-mini-badge tech-tasks-mini-badge--urgent">{urgentN} urgent</span>
                </div>
              </div>
              <ul className="tech-tasks-card-list">
                {list.map((t) => {
                  const reporterName = (t.contactName && t.contactName.trim()) || 'Reporter'
                  const reporterEmail = t.reporterEmail || t.contactEmail || '—'
                  const solved = t.status === 'RESOLVED' || t.status === 'CLOSED'
                  const imageAtts = Array.isArray(t.attachments)
                    ? t.attachments.filter(isImageAttachment)
                    : []
                  const firstImage = imageAtts[0] || null
                  const sameEmail =
                    t.assignedToEmail &&
                    user.email &&
                    String(t.assignedToEmail).toLowerCase() === String(user.email).toLowerCase()
                  const assigneeLabel = sameEmail ? 'You' : t.assignedToEmail || '—'
                  return (
                    <li key={t.id}>
                      <article className="tech-tasks-card">
                        <div className="tech-tasks-card-accent" aria-hidden />
                        <div className="tech-tasks-card-top">
                          <h4 className="tech-tasks-card-headline">
                            <Link to={`/tickets/${t.id}`}>{(t.title && t.title.trim()) || `Ticket #${t.id}`}</Link>
                          </h4>
                          <span className={statusBadgeClass(t.status)}>{String(t.status).replaceAll('_', ' ')}</span>
                        </div>
                        {firstImage ? (
                          <a
                            className="tech-tasks-card-image-link"
                            href={ticketAttachmentDownloadUrl(t.id, firstImage.id)}
                            target="_blank"
                            rel="noreferrer"
                            title={firstImage.originalFilename || 'Ticket image'}
                          >
                            <img
                              src={ticketAttachmentDownloadUrl(t.id, firstImage.id)}
                              alt={firstImage.originalFilename || `Ticket ${t.id} image`}
                              className="tech-tasks-card-image"
                              loading="lazy"
                            />
                          </a>
                        ) : null}
                        <div className="tech-tasks-card-user">
                          <div className="tech-tasks-card-avatar" aria-hidden>
                            {displayInitial(reporterName, reporterEmail)}
                          </div>
                          <div className="tech-tasks-card-user-text">
                            <p className="tech-tasks-card-name">{reporterName}</p>
                            <p className="tech-tasks-card-email">{reporterEmail}</p>
                          </div>
                          <span className="tech-tasks-card-when">{relativeTime(t.updatedAt || t.createdAt)}</span>
                        </div>
                        <div className="tech-tasks-card-meta">
                          <span className="tech-tasks-priority">{t.priority || 'MEDIUM'}</span>
                          <span className="tech-tasks-assignee">{assigneeLabel}</span>
                          {solved ? <span className="tech-tasks-solved">Solved</span> : null}
                          {t.status === 'REJECTED' ? <span className="tech-tasks-rejected">Rejected</span> : null}
                        </div>
                        <div className="tech-tasks-card-times">
                          <div>
                            <span className="tech-tasks-time-label">Created</span>
                            <span className="tech-tasks-time-value">{formatDateTime(t.createdAt)}</span>
                          </div>
                          <div title="Exact assignment time is not stored; shown when available from updates.">
                            <span className="tech-tasks-time-label">Assigned</span>
                            <span className="tech-tasks-time-value">—</span>
                          </div>
                          <div>
                            <span className="tech-tasks-time-label">Updated</span>
                            <span className="tech-tasks-time-value">{formatDateTime(t.updatedAt || t.createdAt)}</span>
                          </div>
                        </div>
                        {t.status === 'OPEN' || t.status === 'IN_PROGRESS' ? (
                          <div className="tech-tasks-card-actions">
                            <button
                              type="button"
                              className="btn primary tech-tasks-solve-btn"
                              disabled={solvingTicketId === t.id}
                              onClick={() => void markSolved(t)}
                            >
                              {solvingTicketId === t.id ? 'Solving…' : 'Solve'}
                            </button>
                          </div>
                        ) : null}
                      </article>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </section>

      <div className="tech-panel-footer-actions">
        <button type="button" className="btn secondary tech-panel-cta" onClick={() => void loadTickets()}>
          <HiArrowPath style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Refresh now
        </button>
      </div>
    </TechnicianTechPanelShell>
  )
}
