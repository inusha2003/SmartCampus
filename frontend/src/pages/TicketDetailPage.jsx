import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api, ticketAttachmentDownloadUrl } from '../api/client'

function isImageAttachment(a) {
  if (a.contentType && a.contentType.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.originalFilename || '')
}
import { useAuth } from '../auth/AuthContext'

export function TicketDetailPage() {
  const MAX_TEXT = 1000
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [comments, setComments] = useState([])
  const [attachments, setAttachments] = useState([])
  const [staff, setStaff] = useState([])
  const [commentBody, setCommentBody] = useState('')
  const [status, setStatus] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [resolution, setResolution] = useState('')
  const [err, setErr] = useState(null)

  const tid = Number(id)

  const load = async () => {
    const [{ data: t }, { data: c }, { data: a }] = await Promise.all([
      api.get(`/api/tickets/${tid}`),
      api.get(`/api/tickets/${tid}/comments`),
      api.get(`/api/tickets/${tid}/attachments`),
    ])
    setTicket(t)
    setComments(c)
    setAttachments(a)
    if (user?.role === 'ADMIN' || user?.role === 'TECHNICIAN') {
      try {
        const { data: u1 } = await api.get('/api/admin/users-staff')
        setStaff(u1)
      } catch {
        /* optional */
      }
    }
  }

  useEffect(() => {
    if (user && id) void load().catch(() => setErr('Cannot load ticket'))
  }, [user, id])

  if (authLoading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!ticket) {
    return err ? <p className="error">{err}</p> : <p className="small">Loading…</p>
  }

  const canStaff = user.role === 'ADMIN' || user.role === 'TECHNICIAN'

  const saveStaff = async () => {
    setErr(null)
    const trimmedResolution = resolution.trim()
    if (trimmedResolution.length > MAX_TEXT) {
      setErr(`Resolution notes must be at most ${MAX_TEXT} characters.`)
      return
    }
    if ((status === 'RESOLVED' || status === 'CLOSED') && !trimmedResolution && !ticket.resolutionNotes) {
      setErr('Resolution notes are required when resolving or closing a ticket.')
      return
    }
    try {
      await api.put(`/api/tickets/${tid}`, {
        status: status || null,
        assigneeUserId: assigneeId ? Number(assigneeId) : null,
        resolutionNotes: trimmedResolution || null,
        rejectReason: null,
      })
      setStatus('')
      setAssigneeId('')
      setResolution('')
      await load()
    } catch {
      setErr('Update failed')
    }
  }

  const reject = async () => {
    const reason = window.prompt('Rejection reason:', '')
    if (!reason) return
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setErr('Rejection reason is required.')
      return
    }
    if (trimmedReason.length > MAX_TEXT) {
      setErr(`Rejection reason must be at most ${MAX_TEXT} characters.`)
      return
    }
    try {
      await api.put(`/api/tickets/${tid}`, {
        status: 'REJECTED',
        rejectReason: trimmedReason,
      })
      await load()
    } catch {
      setErr('Reject failed (admin only)')
    }
  }

  const addComment = async (e) => {
    e.preventDefault()
    const trimmedComment = commentBody.trim()
    if (!trimmedComment) {
      setErr('Comment body is required.')
      return
    }
    if (trimmedComment.length > MAX_TEXT) {
      setErr(`Comment body must be at most ${MAX_TEXT} characters.`)
      return
    }
    try {
      await api.post(`/api/tickets/${tid}/comments`, { body: trimmedComment })
      setCommentBody('')
      await load()
    } catch {
      setErr('Comment failed')
    }
  }

  const download = async (att) => {
    const { data } = await api.get(`/api/tickets/${tid}/attachments/${att.id}/download`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = att.originalFilename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <p className="small">
        <Link to="/tickets">← Back</Link>
      </p>
      <h1>
        Ticket #{ticket.id}{' '}
        <span className="tag">{ticket.status.replaceAll('_', ' ')}</span>
      </h1>
      <div className="card">
        {ticket.title?.trim() ? (
          <p className="ticket-detail-title-text">{ticket.title.trim()}</p>
        ) : null}
        {ticket.contactName?.trim() ? (
          <p className="small">Contact: {ticket.contactName.trim()}</p>
        ) : null}
        <p className="small">
          {ticket.category} · {ticket.priority}
        </p>
        <p>{ticket.description}</p>
        {ticket.resolutionNotes && <p className="small">Resolution: {ticket.resolutionNotes}</p>}
        {ticket.assignedToEmail && <p className="small">Assigned: {ticket.assignedToEmail}</p>}
      </div>
      {attachments.length > 0 && (
        <div className="card">
          <h2>Attachments</h2>
          {attachments.some(isImageAttachment) ? (
            <div className="ticket-detail-attachments-visual">
              {attachments.filter(isImageAttachment).map((a) => (
                <div key={a.id} className="ticket-detail-attachment-cell">
                  <a
                    className="ticket-queue-photo-link"
                    href={ticketAttachmentDownloadUrl(tid, a.id)}
                    target="_blank"
                    rel="noreferrer"
                    title="Open full size"
                  >
                    <img
                      src={ticketAttachmentDownloadUrl(tid, a.id)}
                      alt={a.originalFilename || `Attachment ${a.id}`}
                      className="ticket-queue-thumb"
                      loading="lazy"
                    />
                  </a>
                  <p className="ticket-detail-attachment-name small">{a.originalFilename}</p>
                  <button type="button" className="btn ghost ticket-detail-attachment-dl" onClick={() => void download(a)}>
                    Download
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {attachments.some((a) => !isImageAttachment(a)) ? (
            <ul className={`ticket-queue-file-list ${attachments.some(isImageAttachment) ? 'mt-4' : ''}`}>
              {attachments
                .filter((a) => !isImageAttachment(a))
                .map((a) => (
                  <li key={a.id}>
                    <button type="button" className="btn ghost" onClick={() => void download(a)}>
                      {a.originalFilename}
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      )}
      {canStaff && (
        <div className="card">
          <h2>Staff update</h2>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">— no change —</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>
          {canStaff && staff.length > 0 && (
            <div className="field">
              <label>Assign to</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">—</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Resolution notes</label>
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </div>
          <div className="row-actions">
            <button type="button" className="btn primary" onClick={() => void saveStaff()}>
              Save
            </button>
            {user.role === 'ADMIN' && (
              <button type="button" className="btn danger" onClick={() => void reject()}>
                Reject ticket
              </button>
            )}
          </div>
        </div>
      )}
      <div className="card">
        <h2>Comments</h2>
        {comments.map((c) => (
          <div
            key={c.id}
            style={{
              marginBottom: '0.75rem',
              borderBottom: '1px solid #334155',
              paddingBottom: '0.5rem',
            }}
          >
            <strong>{c.authorName}</strong>
            <span className="small"> · {new Date(c.createdAt).toLocaleString()}</span>
            <p>{c.body}</p>
          </div>
        ))}
        <form onSubmit={(e) => void addComment(e)}>
          <div className="field">
            <label>Add comment</label>
            <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} required />
          </div>
          <button type="submit" className="btn primary">
            Post
          </button>
        </form>
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  )
}
