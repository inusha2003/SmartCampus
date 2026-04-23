import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, ticketAttachmentDownloadUrl } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { HiOutlineTicket, HiOutlineMagnifyingGlass } from 'react-icons/hi2'

const MAX_TEXT = 4000

function formatIncId(id) {
  return `INC-${String(id).padStart(4, '0')}`
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

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

function isImageAttachment(a) {
  if (a?.contentType && a.contentType.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a?.originalFilename || '')
}

function reporterInitial(ticket) {
  const s = (ticket?.contactName || ticket?.reporterEmail || '?').trim()
  const ch = s.charAt(0)
  return ch ? ch.toUpperCase() : '?'
}

function priorityAccent(priority) {
  if (priority === 'URGENT') return 'admin-tickets-queue-card--urgent'
  if (priority === 'HIGH') return 'admin-tickets-queue-card--high'
  return 'admin-tickets-queue-card--default'
}

export function AdminTicketsPage() {
  const { user, loading: authLoading } = useAuth()
  const [list, setList] = useState([])
  const [staff, setStaff] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState('all')
  const [panelStatus, setPanelStatus] = useState('')
  const [panelAssignee, setPanelAssignee] = useState('')
  const [panelResolution, setPanelResolution] = useState('')
  const [err, setErr] = useState(null)
  const [saving, setSaving] = useState(false)

  const loadList = useCallback(async () => {
    const { data } = await api.get('/api/tickets')
    setList(Array.isArray(data) ? data : [])
  }, [])

  const loadDetail = useCallback(async (id) => {
    if (id == null) {
      setDetail(null)
      return
    }
    const { data } = await api.get(`/api/tickets/${id}`)
    setDetail(data)
    setPanelStatus(data.status || 'OPEN')
    setPanelAssignee(data.assignedToId != null ? String(data.assignedToId) : '')
    setPanelResolution(data.resolutionNotes || '')
  }, [])

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    void loadList().catch(() => setErr('Failed to load tickets'))
    void api
      .get('/api/admin/users-staff')
      .then(({ data }) => setStaff(Array.isArray(data) ? data : []))
      .catch(() => setStaff([]))
  }, [user, loadList])

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null)
      return
    }
    void loadDetail(selectedId).catch(() => setErr('Cannot load ticket'))
  }, [selectedId, loadDetail])

  const filtered = useMemo(() => {
    let rows = [...list]
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((t) => {
        const idStr = String(t.id)
        const title = (t.title || '').toLowerCase()
        const email = (t.reporterEmail || '').toLowerCase()
        const contact = (t.contactEmail || '').toLowerCase()
        return idStr.includes(q) || title.includes(q) || email.includes(q) || contact.includes(q)
      })
    }
    if (statusFilter) {
      rows = rows.filter((t) => t.status === statusFilter)
    }
    if (quickFilter === 'unassigned') {
      rows = rows.filter((t) => t.assignedToId == null)
    } else if (quickFilter === 'priority') {
      rows = rows.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT')
    } else if (quickFilter === 'today') {
      rows = rows.filter((t) => {
        const u = t.updatedAt || t.createdAt
        if (!u) return false
        const d = new Date(u)
        const n = new Date()
        return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
      })
    }
    rows.sort((a, b) => {
      const ta = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      return ta
    })
    return rows
  }, [list, search, statusFilter, quickFilter])

  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId != null) setSelectedId(null)
      return
    }
    if (selectedId == null || !filtered.some((t) => t.id === selectedId)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  const saveStaff = async () => {
    if (!detail) return
    setErr(null)
    const trimmedRes = panelResolution.trim()
    if (trimmedRes.length > MAX_TEXT) {
      setErr(`Resolution notes must be at most ${MAX_TEXT} characters.`)
      return
    }
    if ((panelStatus === 'RESOLVED' || panelStatus === 'CLOSED') && !trimmedRes && !detail.resolutionNotes) {
      setErr('Resolution notes are required when resolving or closing.')
      return
    }
    setSaving(true)
    try {
      await api.put(`/api/tickets/${detail.id}`, {
        status: panelStatus || null,
        assigneeUserId: panelAssignee ? Number(panelAssignee) : null,
        resolutionNotes: trimmedRes || null,
        rejectReason: null,
      })
      await loadList()
      await loadDetail(detail.id)
    } catch {
      setErr('Update failed')
    } finally {
      setSaving(false)
    }
  }

  const rejectTicket = async () => {
    if (!detail) return
    const reason = window.prompt('Rejection reason:', '')
    if (!reason?.trim()) return
    if (reason.trim().length > MAX_TEXT) {
      setErr(`Reason must be at most ${MAX_TEXT} characters.`)
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await api.put(`/api/tickets/${detail.id}`, {
        status: 'REJECTED',
        rejectReason: reason.trim(),
      })
      await loadList()
      await loadDetail(detail.id)
    } catch {
      setErr('Reject failed')
    } finally {
      setSaving(false)
    }
  }

  const deleteTicket = async () => {
    if (!detail) return
    if (!window.confirm(`Delete ${formatIncId(detail.id)} permanently?`)) return
    setErr(null)
    try {
      await api.delete(`/api/tickets/${detail.id}/admin`)
      setSelectedId(null)
      setDetail(null)
      await loadList()
    } catch {
      setErr('Delete failed')
    }
  }

  const closeTicket = async () => {
    if (!detail) return
    let notes = (panelResolution.trim() || detail.resolutionNotes || '').trim()
    if (!notes) {
      const p = window.prompt('Resolution / closure note (required):', '')
      if (!p?.trim()) {
        setErr('A note is required to close.')
        return
      }
      notes = p.trim()
      setPanelResolution(notes)
    }
    setSaving(true)
    setErr(null)
    try {
      await api.put(`/api/tickets/${detail.id}`, {
        status: 'CLOSED',
        assigneeUserId: panelAssignee ? Number(panelAssignee) : null,
        resolutionNotes: notes,
        rejectReason: null,
      })
      setPanelStatus('CLOSED')
      await loadList()
      await loadDetail(detail.id)
    } catch {
      setErr('Close failed')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />

  const imageAtts = detail?.attachments ? detail.attachments.filter(isImageAttachment) : []

  return (
    <div className="admin-tickets-desk">
      <header className="admin-tickets-toolbar">
        <div className="admin-tickets-toolbar-row">
          <div className="admin-tickets-search-wrap">
            <HiOutlineMagnifyingGlass className="admin-tickets-search-icon" aria-hidden />
            <input
              type="search"
              className="admin-tickets-search"
              placeholder="Search by title, reporter, or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tickets"
            />
          </div>
          <select
            className="admin-tickets-select admin-tickets-select--status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All status</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
        <div className="admin-tickets-quick">
          <span className="admin-tickets-quick-label">Quick</span>
          {[
            { id: 'all', label: 'All tickets' },
            { id: 'unassigned', label: 'Unassigned' },
            { id: 'priority', label: 'High + urgent' },
            { id: 'today', label: 'Updated today' },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              className={`admin-tickets-chip${quickFilter === b.id ? ' admin-tickets-chip--active' : ''}`}
              onClick={() => setQuickFilter(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </header>

      <div className="admin-tickets-split">
        <aside className="admin-tickets-queue" aria-label="Ticket queue">
          <div className="admin-tickets-queue-head">
            <div>
              <h2 className="admin-tickets-queue-title">Queue</h2>
              <p className="admin-tickets-queue-sub">Latest incidents first</p>
            </div>
            <span className="admin-tickets-queue-count">{filtered.length} shown</span>
          </div>
          <div className="admin-tickets-queue-list">
            {filtered.length === 0 ? (
              <p className="admin-tickets-empty small">No tickets match these filters.</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`admin-tickets-queue-card ${priorityAccent(t.priority)}${
                    selectedId === t.id ? ' admin-tickets-queue-card--active' : ''
                  }`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <div className="admin-tickets-queue-card-top">
                    <span className="admin-tickets-queue-card-title">{t.title?.trim() || 'Untitled'}</span>
                    <span className={`admin-tickets-status-badge admin-tickets-status-badge--${String(t.status || 'OPEN').toLowerCase()}`}>
                      {String(t.status || '').replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="admin-tickets-queue-inc">{formatIncId(t.id)}</p>
                  <p className="admin-tickets-queue-meta">
                    {t.category || '—'} · {relativeTime(t.createdAt)}
                  </p>
                  <div className="admin-tickets-queue-user">
                    <span className="admin-tickets-queue-avatar" aria-hidden>
                      {reporterInitial(t)}
                    </span>
                    <div>
                      <p className="admin-tickets-queue-name">{t.contactName?.trim() || 'Reporter'}</p>
                      <p className="admin-tickets-queue-email">{t.reporterEmail || t.contactEmail || '—'}</p>
                    </div>
                  </div>
                  <p className="admin-tickets-queue-foot">
                    <span>{t.priority}</span>
                    {t.locationText?.trim() ? <span>{t.locationText.trim()}</span> : null}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="admin-tickets-detail" aria-label="Ticket details">
          {!detail ? (
            <div className="admin-tickets-detail-empty">
              <HiOutlineTicket className="admin-tickets-detail-empty-icon" aria-hidden />
              <p className="small">Select a ticket from the queue</p>
            </div>
          ) : (
            <>
              <div className="admin-tickets-detail-head">
                <div className="admin-tickets-detail-badges">
                  <span className="admin-tickets-pill admin-tickets-pill--muted">Incident</span>
                  <span className={`admin-tickets-status-badge admin-tickets-status-badge--${String(detail.status || 'OPEN').toLowerCase()}`}>
                    {String(detail.status || '').replaceAll('_', ' ')}
                  </span>
                </div>
                <div className="admin-tickets-detail-actions">
                  <Link className="btn ghost admin-tickets-btn-compact" to={`/tickets/${detail.id}`}>
                    Edit
                  </Link>
                  <button type="button" className="btn danger admin-tickets-btn-compact" onClick={() => void deleteTicket()}>
                    Delete
                  </button>
                  <button type="button" className="btn ghost admin-tickets-btn-compact" onClick={() => void closeTicket()} disabled={saving}>
                    Close
                  </button>
                </div>
              </div>

              <h1 className="admin-tickets-detail-title">{detail.title?.trim() || 'Untitled'}</h1>
              <p className="admin-tickets-detail-id">{formatIncId(detail.id)}</p>

              <div className="admin-tickets-detail-times">
                <div className="admin-tickets-time-box">
                  <span className="admin-tickets-time-label">Reported</span>
                  <span className="admin-tickets-time-value">{formatDateTime(detail.createdAt)}</span>
                </div>
                <div className="admin-tickets-time-box">
                  <span className="admin-tickets-time-label">Last activity</span>
                  <span className="admin-tickets-time-value">{formatDateTime(detail.updatedAt || detail.createdAt)}</span>
                </div>
              </div>

              <section className="admin-tickets-panel-block">
                <h3 className="admin-tickets-panel-label">Status &amp; assignment</h3>
                <div className="admin-tickets-assign-row">
                  <select
                    className="admin-tickets-select admin-tickets-select--grow"
                    value={panelStatus}
                    onChange={(e) => setPanelStatus(e.target.value)}
                    aria-label="Status"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                  <select
                    className="admin-tickets-select admin-tickets-select--grow"
                    value={panelAssignee}
                    onChange={(e) => setPanelAssignee(e.target.value)}
                    aria-label="Assign to technician"
                  >
                    <option value="">Select technician</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName} ({s.role})
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn primary admin-tickets-assign-btn" disabled={saving} onClick={() => void saveStaff()}>
                    Assign / save
                  </button>
                </div>
                <button type="button" className="btn danger admin-tickets-reject mt-3" onClick={() => void rejectTicket()} disabled={saving}>
                  Reject ticket
                </button>
              </section>

              <section className="admin-tickets-panel-block">
                <h3 className="admin-tickets-panel-label">Resolution notes</h3>
                <textarea
                  className="admin-tickets-textarea"
                  rows={3}
                  value={panelResolution}
                  onChange={(e) => setPanelResolution(e.target.value)}
                  placeholder="Notes visible to staff and reporter when resolved…"
                />
              </section>

              <section className="admin-tickets-panel-block">
                <h3 className="admin-tickets-panel-label">Description</h3>
                <div className="admin-tickets-description">{detail.description || '—'}</div>
              </section>

              <section className="admin-tickets-panel-block">
                <div className="admin-tickets-photos-head">
                  <h3 className="admin-tickets-panel-label m-0">Uploaded photos</h3>
                  <span className="admin-tickets-file-count">{imageAtts.length} files</span>
                </div>
                {imageAtts.length === 0 ? (
                  <p className="admin-tickets-photos-empty small">No uploaded images for this ticket.</p>
                ) : (
                  <div className="admin-tickets-photo-grid">
                    {imageAtts.map((a) => (
                      <a
                        key={a.id}
                        className="admin-tickets-photo-link"
                        href={ticketAttachmentDownloadUrl(detail.id, a.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={ticketAttachmentDownloadUrl(detail.id, a.id)}
                          alt={a.originalFilename || `Photo ${a.id}`}
                          className="admin-tickets-photo-thumb"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <p className="small admin-tickets-full-link">
                <Link to={`/tickets/${detail.id}`}>Open full ticket page (comments &amp; history) →</Link>
              </p>

              {err ? (
                <p className="error admin-tickets-err" role="alert">
                  {err}
                </p>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
