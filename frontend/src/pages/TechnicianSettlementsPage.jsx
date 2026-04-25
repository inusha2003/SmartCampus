import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { HiBell, HiArrowPath, HiPhoto } from 'react-icons/hi2'
import { api, ticketSettlementDownloadUrl } from '../api/client'
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

export function TechnicianSettlementsPage() {
  const { user, loading: authLoading } = useAuth()
  const [assignedTickets, setAssignedTickets] = useState([])
  const [ticketsErr, setTicketsErr] = useState(null)
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [dto, setDto] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [beforeFile, setBeforeFile] = useState(null)
  const [afterFile, setAfterFile] = useState(null)
  const [saveErr, setSaveErr] = useState(null)
  const [saving, setSaving] = useState(false)
  const [cacheBust, setCacheBust] = useState(0)
  const [beforeBroken, setBeforeBroken] = useState(false)
  const [afterBroken, setAfterBroken] = useState(false)

  const ticketIdNum = selectedTicketId ? Number(selectedTicketId) : null

  const beforePreviewUrl = useMemo(
    () => (beforeFile ? URL.createObjectURL(beforeFile) : null),
    [beforeFile],
  )
  const afterPreviewUrl = useMemo(
    () => (afterFile ? URL.createObjectURL(afterFile) : null),
    [afterFile],
  )

  useEffect(() => {
    return () => {
      if (beforePreviewUrl) URL.revokeObjectURL(beforePreviewUrl)
      if (afterPreviewUrl) URL.revokeObjectURL(afterPreviewUrl)
    }
  }, [beforePreviewUrl, afterPreviewUrl])

  const loadTickets = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await api.get('/api/tickets')
      const list = Array.isArray(data) ? data : []
      const mine = list.filter((t) => Number(t.assignedToId) === Number(user.id))
      setAssignedTickets(mine)
      setTicketsErr(null)
    } catch (e) {
      setTicketsErr(e?.response?.data?.message || e?.message || 'Could not load tickets.')
      setAssignedTickets([])
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || user.role !== 'TECHNICIAN') return
    void loadTickets()
  }, [user?.id, user?.role, loadTickets])

  useEffect(() => {
    if (assignedTickets.length === 0) {
      setSelectedTicketId('')
      return
    }
    setSelectedTicketId((prev) => {
      if (prev && assignedTickets.some((t) => String(t.id) === String(prev))) return prev
      return String(assignedTickets[0].id)
    })
  }, [assignedTickets])

  useEffect(() => {
    setBeforeBroken(false)
    setAfterBroken(false)
  }, [ticketIdNum, cacheBust])

  const loadDto = useCallback(async () => {
    if (!ticketIdNum) {
      setDto(null)
      return
    }
    try {
      const { data } = await api.get(`/api/tickets/${ticketIdNum}/settlement`)
      setDto(data)
      setLoadErr(null)
    } catch (e) {
      const status = e?.response?.status
      if (status === 404) {
        // Some environments may have older backend instances without this route yet.
        // Show an empty state instead of a hard error banner.
        setDto({
          ticketId: ticketIdNum,
          beforePresent: false,
          afterPresent: false,
          beforeFilename: null,
          afterFilename: null,
          updatedAt: null,
        })
        setLoadErr(null)
      } else {
        setLoadErr(e?.response?.data?.message || e?.message || 'Could not load settlement for this ticket.')
        setDto(null)
      }
    }
  }, [ticketIdNum])

  useEffect(() => {
    void loadDto()
  }, [loadDto, ticketIdNum])

  const submit = async () => {
    if (!ticketIdNum) return
    setSaveErr(null)
    if (!beforeFile && !afterFile) {
      setSaveErr('Choose a before image, an after image, or both to upload.')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      if (beforeFile) fd.append('beforeImage', beforeFile)
      if (afterFile) fd.append('afterImage', afterFile)
      const { data } = await api.post(`/api/tickets/${ticketIdNum}/settlement`, fd)
      setDto(data)
      setBeforeFile(null)
      setAfterFile(null)
      setCacheBust((n) => n + 1)
    } catch (e) {
      const d = e?.response?.data
      const status = e?.response?.status
      const msg =
        (status === 404 &&
          'Settlement endpoint is not available on backend yet. Restart backend and try again.') ||
        (typeof d?.message === 'string' && d.message) ||
        (typeof d?.error === 'string' && d.error) ||
        e?.message ||
        'Upload failed.'
      setSaveErr(msg)
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
  if (user.role !== 'TECHNICIAN') return <Navigate to={getDashboardPath(user.role)} replace />

  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase() || '?'
  const today = formatHeaderDate(new Date())

  const beforeServerSrc =
    ticketIdNum && dto?.beforePresent && !beforeBroken
      ? `${ticketSettlementDownloadUrl(ticketIdNum, 'before')}?v=${cacheBust}`
      : null
  const afterServerSrc =
    ticketIdNum && dto?.afterPresent && !afterBroken
      ? `${ticketSettlementDownloadUrl(ticketIdNum, 'after')}?v=${cacheBust}`
      : null

  return (
    <TechnicianTechPanelShell>
      <header className="tech-panel-header">
        <div>
          <p className="tech-panel-date">{today}</p>
          <h1 className="tech-panel-heading">Settlements</h1>
          <p className="tech-panel-sub">
            Pick a ticket you are <strong>assigned</strong> to, then upload <strong>before</strong> and{' '}
            <strong>after</strong> photos. Admins see them on the ticket in Admin Tickets. JPEG, PNG, WebP, or GIF — up
            to 5MB each.
          </p>
        </div>
        <div className="tech-panel-header-right">
          <Link to="/notifications" className="tech-panel-icon-btn" aria-label="Notifications">
            <HiBell />
          </Link>
          <div className="tech-panel-avatar" aria-hidden>
            {initial}
          </div>
        </div>
      </header>

      {ticketsErr && (
        <p className="tech-panel-banner tech-panel-banner-error small" role="alert">
          {ticketsErr}{' '}
          <button type="button" className="tech-panel-link-btn" onClick={() => void loadTickets()}>
            Retry
          </button>
        </p>
      )}

      <div className="tech-settlements-ticket-row">
        <label className="tech-settlements-ticket-label">
          <span className="tech-settlements-ticket-label-text">Ticket</span>
          <select
            className="tech-settlements-ticket-select"
            value={selectedTicketId}
            onChange={(e) => {
              setSelectedTicketId(e.target.value)
              setBeforeFile(null)
              setAfterFile(null)
            }}
            disabled={assignedTickets.length === 0}
          >
            {assignedTickets.length === 0 ? (
              <option value="">No assigned tickets</option>
            ) : (
              assignedTickets.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  #{t.id} — {(t.title && t.title.trim()) || t.category || 'Ticket'}
                </option>
              ))
            )}
          </select>
        </label>
        {ticketIdNum ? (
          <Link className="btn ghost tech-settlements-open-ticket" to={`/tickets/${ticketIdNum}`}>
            Open ticket
          </Link>
        ) : null}
      </div>

      {assignedTickets.length === 0 ? (
        <p className="tech-panel-banner small">
          When an admin assigns a ticket to you, select it here to add settlement photos.
        </p>
      ) : null}

      {loadErr && ticketIdNum ? (
        <p className="tech-panel-banner tech-panel-banner-error small" role="alert">
          {loadErr}{' '}
          <button type="button" className="tech-panel-link-btn" onClick={() => void loadDto()}>
            Retry
          </button>
        </p>
      ) : null}

      <div className="tech-settlements-grid">
        <section className={`tech-settlements-slot${!ticketIdNum ? ' tech-settlements-slot--disabled' : ''}`}>
          <div className="tech-settlements-slot-head">
            <HiPhoto className="tech-settlements-slot-icon" aria-hidden />
            <div>
              <h2 className="tech-settlements-slot-title">Before image</h2>
              <p className="tech-settlements-slot-desc small">State of the site or equipment before you started.</p>
            </div>
          </div>
          <div className="tech-settlements-preview">
            {beforePreviewUrl ? (
              <img src={beforePreviewUrl} alt="Selected before preview" className="tech-settlements-img" />
            ) : beforeServerSrc ? (
              <img
                src={beforeServerSrc}
                alt="Saved before"
                className="tech-settlements-img"
                onError={() => setBeforeBroken(true)}
              />
            ) : (
              <div className="tech-settlements-placeholder small">No before image yet</div>
            )}
          </div>
          <label className="btn ghost tech-settlements-file-btn">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={!ticketIdNum}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setBeforeFile(f)
                e.target.value = ''
              }}
            />
            {beforeFile || dto?.beforePresent ? 'Replace before image' : 'Choose before image'}
          </label>
          {dto?.beforeFilename ? <p className="tech-settlements-filename small">{dto.beforeFilename}</p> : null}
        </section>

        <section className={`tech-settlements-slot${!ticketIdNum ? ' tech-settlements-slot--disabled' : ''}`}>
          <div className="tech-settlements-slot-head">
            <HiPhoto className="tech-settlements-slot-icon" aria-hidden />
            <div>
              <h2 className="tech-settlements-slot-title">After image</h2>
              <p className="tech-settlements-slot-desc small">Same view or area after your work is finished.</p>
            </div>
          </div>
          <div className="tech-settlements-preview">
            {afterPreviewUrl ? (
              <img src={afterPreviewUrl} alt="Selected after preview" className="tech-settlements-img" />
            ) : afterServerSrc ? (
              <img
                src={afterServerSrc}
                alt="Saved after"
                className="tech-settlements-img"
                onError={() => setAfterBroken(true)}
              />
            ) : (
              <div className="tech-settlements-placeholder small">No after image yet</div>
            )}
          </div>
          <label className="btn ghost tech-settlements-file-btn">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={!ticketIdNum}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setAfterFile(f)
                e.target.value = ''
              }}
            />
            {afterFile || dto?.afterPresent ? 'Replace after image' : 'Choose after image'}
          </label>
          {dto?.afterFilename ? <p className="tech-settlements-filename small">{dto.afterFilename}</p> : null}
        </section>
      </div>

      {saveErr ? (
        <p className="tech-panel-banner tech-panel-banner-error small" role="alert">
          {saveErr}
        </p>
      ) : null}

      <div className="tech-panel-footer-actions">
        <button
          type="button"
          className="btn primary tech-panel-cta"
          disabled={saving || !ticketIdNum}
          onClick={() => void submit()}
        >
          {saving ? 'Submitting…' : 'Submit'}
        </button>
        <button
          type="button"
          className="btn secondary tech-panel-cta"
          disabled={saving || !ticketIdNum}
          onClick={() => void loadDto()}
        >
          <HiArrowPath style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Reload from server
        </button>
      </div>

      {dto?.updatedAt ? (
        <p className="tech-settlements-meta small">
          Last updated:{' '}
          {new Date(dto.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      ) : null}
    </TechnicianTechPanelShell>
  )
}
