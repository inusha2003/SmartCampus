import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, NavLink } from 'react-router-dom'
import {
  HiBolt,
  HiSquares2X2,
  HiClipboardDocumentCheck,
  HiChatBubbleLeftRight,
  HiCog6Tooth,
  HiBell,
  HiArrowPath,
} from 'react-icons/hi2'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../auth/roleRouting'

function buildConicGradient(pending, inProgress, completed) {
  const total = pending + inProgress + completed
  if (total === 0) return null
  let acc = 0
  const parts = []
  const push = (n, color) => {
    if (n <= 0) return
    const start = (acc / total) * 360
    acc += n
    const end = (acc / total) * 360
    parts.push(`${color} ${start}deg ${end}deg`)
  }
  push(pending, '#facc15')
  push(inProgress, '#2dd4bf')
  push(completed, '#4ade80')
  return parts.length ? `conic-gradient(${parts.join(', ')})` : null
}

function formatHeaderDate(d) {
  try {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
    const rest = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${weekday}, ${rest}`
  } catch {
    return ''
  }
}

function last7DaysPulse(assigned) {
  const now = new Date()
  const days = []
  for (let i = 6; i >= 0; i -= 1) {
    const start = new Date(now)
    start.setDate(start.getDate() - i)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    const label = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
    const count = assigned.filter((t) => {
      if (!t.updatedAt) return false
      const u = new Date(t.updatedAt)
      return u >= start && u <= end
    }).length
    days.push({ label, count })
  }
  return days
}

function categoryLoad(assigned, limit = 5) {
  const map = new Map()
  for (const t of assigned) {
    const key = (t.category && String(t.category).trim()) || 'Uncategorized'
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

export function TechnicianDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState(null)

  const loadTickets = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await api.get('/api/tickets')
      const list = Array.isArray(data) ? data : []
      const assigned = list.filter((t) => t.assignedToId === user.id)
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

  const stats = useMemo(() => {
    const pending = tickets.filter((t) => t.status === 'OPEN').length
    const inProgress = tickets.filter((t) => t.status === 'IN_PROGRESS').length
    const completed = tickets.filter((t) =>
      ['RESOLVED', 'CLOSED', 'REJECTED'].includes(t.status),
    ).length
    const total = tickets.length
    const openQueue = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length
    const doneForRate = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length
    const completionRate = total > 0 ? Math.round((doneForRate / total) * 100) : 0
    const highPriority = tickets.filter(
      (t) =>
        (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
        (t.priority === 'HIGH' || t.priority === 'URGENT'),
    ).length
    const donutStyle = buildConicGradient(pending, inProgress, completed)
    const pulse = last7DaysPulse(tickets)
    const categories = categoryLoad(tickets)
    const maxPulse = Math.max(1, ...pulse.map((d) => d.count))
    const maxCat = Math.max(1, ...categories.map(([, n]) => n))
    return {
      pending,
      inProgress,
      completed,
      total,
      openQueue,
      completionRate,
      highPriority,
      donutStyle,
      pulse,
      categories,
      maxPulse,
      maxCat,
    }
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

  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase() || '?'
  const today = formatHeaderDate(new Date())

  return (
    <div className="tech-panel-root">
      <aside className="tech-panel-sidebar">
        <div className="tech-panel-brand">
          <span className="tech-panel-brand-icon" aria-hidden>
            <HiBolt />
          </span>
          <div>
            <div className="tech-panel-brand-title">TechPanel</div>
            <div className="tech-panel-brand-sub">Campus operations</div>
          </div>
        </div>
        <nav className="tech-panel-nav" aria-label="Technician panel">
          <NavLink end to="/dashboard/technician" className={({ isActive }) => `tech-panel-nav-item${isActive ? ' is-active' : ''}`}>
            <HiSquares2X2 className="tech-panel-nav-ico" aria-hidden />
            Dashboard
          </NavLink>
          <NavLink to="/tickets" className={({ isActive }) => `tech-panel-nav-item${isActive ? ' is-active' : ''}`}>
            <HiClipboardDocumentCheck className="tech-panel-nav-ico" aria-hidden />
            Tasks
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `tech-panel-nav-item${isActive ? ' is-active' : ''}`}>
            <HiChatBubbleLeftRight className="tech-panel-nav-ico" aria-hidden />
            Activity
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `tech-panel-nav-item${isActive ? ' is-active' : ''}`}>
            <HiCog6Tooth className="tech-panel-nav-ico" aria-hidden />
            Settings
          </NavLink>
        </nav>
      </aside>

      <div className="tech-panel-main">
        <header className="tech-panel-header">
          <div>
            <p className="tech-panel-date">{today}</p>
            <h1 className="tech-panel-heading">Dashboard</h1>
            <p className="tech-panel-sub">
              Welcome back, <strong>{user.displayName || 'Technician'}</strong>
              <span className="tech-panel-sub-dot"> • </span>
              Here is your workload at a glance.
            </p>
            <p className="tech-panel-live">
              <span className="tech-panel-live-dot" aria-hidden />
              Live sync — refreshes every 30s
            </p>
          </div>
          <div className="tech-panel-header-right">
            <div className="tech-panel-kpi-mini" title="Completion rate (resolved + closed / assigned)">
              <span className="tech-panel-kpi-mini-label">Completion rate</span>
              <span className="tech-panel-kpi-mini-value">{stats.completionRate}%</span>
            </div>
            <Link to="/notifications" className="tech-panel-icon-btn" aria-label="Notifications">
              <HiBell />
            </Link>
            <div className="tech-panel-avatar" aria-hidden>
              {initial}
            </div>
          </div>
        </header>

        {loadState === 'loading' && (
          <p className="tech-panel-banner small">Loading your assigned tickets…</p>
        )}
        {loadState === 'error' && loadError && (
          <p className="tech-panel-banner tech-panel-banner-error small" role="alert">
            {loadError}{' '}
            <button type="button" className="tech-panel-link-btn" onClick={() => loadTickets()}>
              Retry
            </button>
          </p>
        )}

        <div className="tech-panel-top-grid">
          <section className="tech-panel-card tech-panel-card-wide">
            <div className="tech-panel-card-tags">
              <span className="tech-panel-pill">Live breakdown</span>
              <span className="tech-panel-pill tech-panel-pill-muted">Tech analytics</span>
            </div>
            <h2 className="tech-panel-card-title">Status distribution</h2>
            <p className="tech-panel-card-desc">
              Track assigned workload, open queue pressure, and completed tickets in one glance.
            </p>
            <div className="tech-panel-donut-row">
              <div className="tech-panel-donut-wrap">
                {stats.donutStyle ? (
                  <div className="tech-panel-donut" style={{ background: stats.donutStyle }}>
                    <div className="tech-panel-donut-hole" />
                  </div>
                ) : (
                  <div className="tech-panel-donut-empty small">No assigned tickets yet</div>
                )}
              </div>
              <ul className="tech-panel-legend">
                <li>
                  <span className="tech-panel-legend-dot" style={{ background: '#facc15' }} />
                  Pending <strong>{stats.pending}</strong>
                </li>
                <li>
                  <span className="tech-panel-legend-dot" style={{ background: '#2dd4bf' }} />
                  In progress <strong>{stats.inProgress}</strong>
                </li>
                <li>
                  <span className="tech-panel-legend-dot" style={{ background: '#4ade80' }} />
                  Completed <strong>{stats.completed}</strong>
                </li>
              </ul>
            </div>
          </section>

          <div className="tech-panel-kpi-stack">
            <div className="tech-panel-kpi tech-panel-kpi-blue">
              <span className="tech-panel-kpi-label">Total tasks</span>
              <span className="tech-panel-kpi-num">{stats.total}</span>
              <span className="tech-panel-kpi-hint">Assigned to you</span>
            </div>
            <div className="tech-panel-kpi tech-panel-kpi-violet">
              <span className="tech-panel-kpi-label">Open queue</span>
              <span className="tech-panel-kpi-num">{stats.openQueue}</span>
              <span className="tech-panel-kpi-hint">Pending + In progress</span>
            </div>
            <div className="tech-panel-kpi tech-panel-kpi-green">
              <span className="tech-panel-kpi-label">Completion rate</span>
              <span className="tech-panel-kpi-num">{stats.completionRate}%</span>
              <span className="tech-panel-kpi-hint">Resolved or closed</span>
            </div>
            <div className="tech-panel-kpi tech-panel-kpi-orange">
              <span className="tech-panel-kpi-label">High priority</span>
              <span className="tech-panel-kpi-num">{stats.highPriority}</span>
              <span className="tech-panel-kpi-hint">Need attention</span>
            </div>
          </div>
        </div>

        <div className="tech-panel-bottom-grid">
          <section className="tech-panel-card">
            <div className="tech-panel-card-tags">
              <span className="tech-panel-pill">Category metrics</span>
              <span className="tech-panel-pill tech-panel-pill-muted">Assignment load</span>
            </div>
            <h2 className="tech-panel-card-title">Workload by category</h2>
            <p className="tech-panel-card-desc">See where assigned incidents are concentrated.</p>
            {stats.categories.length === 0 ? (
              <p className="small tech-panel-muted">No category data yet.</p>
            ) : (
              <ul className="tech-panel-bar-list">
                {stats.categories.map(([name, n]) => (
                  <li key={name}>
                    <div className="tech-panel-bar-head">
                      <span className="tech-panel-bar-name">{name}</span>
                      <span className="tech-panel-bar-count">{n}</span>
                    </div>
                    <div className="tech-panel-bar-track">
                      <div
                        className="tech-panel-bar-fill"
                        style={{ width: `${Math.round((n / stats.maxCat) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tech-panel-card">
            <div className="tech-panel-card-tags">
              <span className="tech-panel-pill">Activity trend</span>
              <span className="tech-panel-pill tech-panel-pill-muted">Weekly flow</span>
            </div>
            <h2 className="tech-panel-card-title">7-day task pulse</h2>
            <p className="tech-panel-card-desc">Ticket updates on your assignments over the last week.</p>
            <div className="tech-panel-pulse">
              {stats.pulse.map((d) => (
                <div key={d.label} className="tech-panel-pulse-col">
                  <div
                    className="tech-panel-pulse-bar"
                    style={{ height: `${Math.max(8, (d.count / stats.maxPulse) * 100)}%` }}
                    title={`${d.count} update(s)`}
                  />
                  <span className="tech-panel-pulse-label">{d.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="tech-panel-footer-actions">
          <Link to="/tickets" className="btn primary tech-panel-cta">
            Open ticket queue
          </Link>
          <button type="button" className="btn secondary tech-panel-cta" onClick={() => loadTickets()}>
            <HiArrowPath style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Refresh now
          </button>
        </div>
      </div>
    </div>
  )
}
