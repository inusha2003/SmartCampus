import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ticketAttachmentDownloadUrl } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { RequireUser } from '../components/RequireUser'
import {
  HiOutlineExclamationTriangle,
  HiOutlinePencilSquare,
  HiOutlinePhoto,
  HiOutlineTicket,
  HiOutlineWrenchScrewdriver,
} from 'react-icons/hi2'
import { TicketPhotoEditor } from '../components/TicketPhotoEditor'

const LOCATION_OTHER = '__other__'

const RELATED_INCIDENT_TYPES = [
  'IT Support',
  'Maintenance',
  'Electrical Issues',
  'Cleaning and Waste',
  'Fire',
]

/** SLIIT Malabe campus areas for ticket location. */
const MAX_TICKET_PHOTOS = 3

function formatTicketTimestamp(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

function isImageAttachment(a) {
  if (a.contentType && a.contentType.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.originalFilename || '')
}

const SLIIT_LOCATIONS = [
  'SLIIT Auditorium',
  'SLIIT Faculty of Business',
  'SLIIT Computing Faculty',
  'SLIIT Engineering Faculty',
  'SLIIT Grounds / outdoor areas',
  'SLIIT Library',
  'SLIIT Main Building',
  'SLIIT Parking',
  'SLIIT Sports complex',
  'SLIIT Student center / cafeteria',
]

export function TicketsPage() {
  const MAX_CATEGORY = 120
  const MAX_LOCATION = 500
  const MAX_DESCRIPTION = 4000
  const MAX_CONTACT_EMAIL = 254
  const MAX_CONTACT_PHONE = 25
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const PHONE_RE = /^[+0-9()\-\s]{7,25}$/
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [relatedIncident, setRelatedIncident] = useState('')
  const [locationSelect, setLocationSelect] = useState('')
  const [locationOther, setLocationOther] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [photoSlots, setPhotoSlots] = useState(() =>
    Array.from({ length: MAX_TICKET_PHOTOS }, () => null),
  )
  const [photoEditorSlot, setPhotoEditorSlot] = useState(null)
  const [err, setErr] = useState(null)

  const photoPreviewUrls = useMemo(
    () => photoSlots.map((f) => (f ? URL.createObjectURL(f) : null)),
    [photoSlots],
  )

  useEffect(() => {
    return () => {
      photoPreviewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [photoPreviewUrls])

  const setPhotoAt = (index, file) => {
    setPhotoSlots((prev) => {
      const next = [...prev]
      next[index] = file
      return next
    })
  }

  const clearPhotoAt = (index) => {
    setPhotoAt(index, null)
  }

  const load = async () => {
    const { data: t } = await api.get('/api/tickets')
    setTickets(t)
  }

  useEffect(() => {
    if (user) void load().catch(() => setErr('Failed to load tickets'))
  }, [user])

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    const trimmedLocation =
      locationSelect === LOCATION_OTHER ? locationOther.trim() : locationSelect.trim()
    const trimmedIncident = relatedIncident.trim()
    const trimmedDescription = description.trim()
    const trimmedEmail = contactEmail.trim()
    const trimmedPhone = contactPhone.trim()
    if (!trimmedIncident) {
      setErr('Select a related incident.')
      return
    }
    if (trimmedIncident.length > MAX_CATEGORY) {
      setErr(`Related incident must be at most ${MAX_CATEGORY} characters.`)
      return
    }
    if (!trimmedLocation) {
      setErr('Select a campus location.')
      return
    }
    if (trimmedLocation.length > MAX_LOCATION) {
      setErr(`Location text must be at most ${MAX_LOCATION} characters.`)
      return
    }
    if (!trimmedDescription) {
      setErr('Description is required.')
      return
    }
    if (trimmedDescription.length > MAX_DESCRIPTION) {
      setErr(`Description must be at most ${MAX_DESCRIPTION} characters.`)
      return
    }
    if (trimmedEmail.length > MAX_CONTACT_EMAIL || (trimmedEmail && !EMAIL_RE.test(trimmedEmail))) {
      setErr('Contact email format is invalid.')
      return
    }
    if (trimmedPhone.length > MAX_CONTACT_PHONE || (trimmedPhone && !PHONE_RE.test(trimmedPhone))) {
      setErr('Contact phone format is invalid.')
      return
    }
    const attachedPhotos = photoSlots.filter(Boolean)
    const fd = new FormData()
    fd.append('locationText', trimmedLocation)
    fd.append('category', trimmedIncident)
    fd.append('description', trimmedDescription)
    fd.append('priority', priority)
    if (trimmedEmail) fd.append('contactEmail', trimmedEmail)
    if (trimmedPhone) fd.append('contactPhone', trimmedPhone)
    for (const f of attachedPhotos) {
      fd.append('files', f)
    }
    try {
      await api.post('/api/tickets', fd)
      setDescription('')
      setPhotoSlots(Array.from({ length: MAX_TICKET_PHOTOS }, () => null))
      setRelatedIncident('')
      setLocationSelect('')
      setLocationOther('')
      await load()
    } catch {
      setErr('Could not create ticket (max 3 images, check fields).')
    }
  }

  return (
    <RequireUser>
    <div>
      <section className="hero-card rainbow mb-6">
        <div className="hero-grid">
          <div className="relative z-10">
            <p className="glass-chip">Incident Command Center</p>
            <h1 className="mt-3 flex items-center gap-2">
              <HiOutlineWrenchScrewdriver className="text-cyan-300" />
              <span className="gradient-title">Report. Track. Resolve.</span>
            </h1>
            <p className="small max-w-2xl">
              Create tickets with photo evidence, collaborate with technicians, and keep every
              issue visible from open to closure.
            </p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1100&q=80"
            alt="Technician maintenance setup"
            className="feature-image"
          />
        </div>
      </section>

      <h1 className="flex items-center gap-2">
        <HiOutlineWrenchScrewdriver className="text-cyan-300" />
        Maintenance &amp; incidents
      </h1>
      <div className="card-grid">
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineTicket className="text-violet-300" /> Total tickets</p>
          <p className="text-3xl font-bold metric-value">{tickets.length}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineExclamationTriangle className="text-amber-300" /> Open/In progress</p>
          <p className="text-3xl font-bold metric-value">{tickets.filter((x) => x.status === 'OPEN' || x.status === 'IN_PROGRESS').length}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlinePhoto className="text-emerald-300" /> Evidence ready</p>
          <p className="text-3xl font-bold metric-value">Up to 3 images</p>
        </div>
      </div>
      <div className="card">
        <h2>Report an issue</h2>
        <form onSubmit={(e) => void submit(e)}>
          <div className="field">
            <label>Related incident</label>
            <select value={relatedIncident} onChange={(e) => setRelatedIncident(e.target.value)}>
              <option value="">Select incident</option>
              {RELATED_INCIDENT_TYPES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Location / area</label>
            <select
              value={locationSelect}
              onChange={(e) => {
                const v = e.target.value
                setLocationSelect(v)
                if (v !== LOCATION_OTHER) setLocationOther('')
              }}
            >
              <option value="">Select a location</option>
              {SLIIT_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
              <option value={LOCATION_OTHER}>Other (describe below)</option>
            </select>
            {locationSelect === LOCATION_OTHER && (
              <input
                className="mt-2"
                value={locationOther}
                onChange={(e) => setLocationOther(e.target.value)}
                placeholder="e.g. room number or area not listed"
                aria-label="Custom location description"
              />
            )}
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
          <div className="field">
            <label>Contact email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Contact phone</label>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div className="field">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#c6d7ff]">
              Images (max 3)
            </span>
            <p className="small mb-3 max-w-[640px]">
              Optional — use each slot for one photo. You can submit with any number of slots filled
              (0–3).
            </p>
            <div className="ticket-photo-slots" aria-live="polite">
              {photoSlots.map((file, i) => {
                const previewUrl = photoPreviewUrls[i]
                const inputId = `ticket-photo-slot-${i}`
                return (
                  <div key={i} className="ticket-photo-slot">
                    <span className="ticket-photo-slot-title">Photo {i + 1}</span>
                    <input
                      id={inputId}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const picked = e.target.files?.[0] ?? null
                        setPhotoAt(i, picked)
                        e.target.value = ''
                      }}
                    />
                    {previewUrl ? (
                      <div className="ticket-photo-slot-body">
                        <img
                          src={previewUrl}
                          alt={`Photo ${i + 1} preview`}
                          className="ticket-photo-slot-img"
                        />
                        <div className="ticket-photo-slot-actions">
                          <button
                            type="button"
                            className="btn ghost ticket-photo-slot-edit"
                            onClick={() => setPhotoEditorSlot(i)}
                          >
                            <HiOutlinePencilSquare className="inline-block h-4 w-4 align-text-bottom" aria-hidden />
                            <span className="ml-1">Annotate</span>
                          </button>
                          <button
                            type="button"
                            className="btn ghost ticket-photo-slot-remove"
                            onClick={() => clearPhotoAt(i)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor={inputId} className="ticket-photo-slot-add">
                        <HiOutlinePhoto className="ticket-photo-slot-icon" aria-hidden />
                        <span>Add photo</span>
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {err && <p className="error">{err}</p>}
          <button type="submit" className="btn primary">
            Submit ticket
          </button>
        </form>
      </div>
      <h2>Your tickets &amp; queue</h2>
      {tickets.map((t) => {
        const attachments = Array.isArray(t.attachments) ? t.attachments : []
        const imageAtts = attachments.filter(isImageAttachment)
        const otherAtts = attachments.filter((a) => !isImageAttachment(a))
        return (
          <div key={t.id} className="card ticket-queue-card">
            <div className="ticket-queue-head">
              <div className="ticket-queue-tags">
                <span className="tag">{t.status.replaceAll('_', ' ')}</span>
                <span className="tag warn">{t.priority}</span>
              </div>
              <h2 className="ticket-queue-title">
                <Link to={`/tickets/${t.id}`}>Ticket #{t.id}</Link>
              </h2>
            </div>
            <dl className="ticket-queue-meta">
              <div className="ticket-queue-meta-row">
                <dt>Related incident</dt>
                <dd>{t.category}</dd>
              </div>
              <div className="ticket-queue-meta-row">
                <dt>Location</dt>
                <dd>{t.locationText?.trim() ? t.locationText : '—'}</dd>
              </div>
              {t.resourceName ? (
                <div className="ticket-queue-meta-row">
                  <dt>Related resource</dt>
                  <dd>{t.resourceName}</dd>
                </div>
              ) : null}
              <div className="ticket-queue-meta-row">
                <dt>Submitted</dt>
                <dd>{formatTicketTimestamp(t.createdAt) || '—'}</dd>
              </div>
              {t.contactEmail ? (
                <div className="ticket-queue-meta-row">
                  <dt>Contact email</dt>
                  <dd>{t.contactEmail}</dd>
                </div>
              ) : null}
              {t.contactPhone ? (
                <div className="ticket-queue-meta-row">
                  <dt>Contact phone</dt>
                  <dd>{t.contactPhone}</dd>
                </div>
              ) : null}
            </dl>
            <div className="ticket-queue-block">
              <h3 className="ticket-queue-block-title">Description</h3>
              <p className="ticket-queue-description">{t.description || '—'}</p>
            </div>
            {t.resolutionNotes ? (
              <div className="ticket-queue-block">
                <h3 className="ticket-queue-block-title">Resolution notes</h3>
                <p className="ticket-queue-description">{t.resolutionNotes}</p>
              </div>
            ) : null}
            {imageAtts.length > 0 ? (
              <div className="ticket-queue-block">
                <h3 className="ticket-queue-block-title">Photos</h3>
                <div className="ticket-queue-photo-grid">
                  {imageAtts.map((a) => (
                    <a
                      key={a.id}
                      className="ticket-queue-photo-link"
                      href={ticketAttachmentDownloadUrl(t.id, a.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={ticketAttachmentDownloadUrl(t.id, a.id)}
                        alt={a.originalFilename || `Attachment ${a.id}`}
                        className="ticket-queue-thumb"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {otherAtts.length > 0 ? (
              <div className="ticket-queue-block">
                <h3 className="ticket-queue-block-title">Other attachments</h3>
                <ul className="ticket-queue-file-list">
                  {otherAtts.map((a) => (
                    <li key={a.id}>
                      <a
                        href={ticketAttachmentDownloadUrl(t.id, a.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="small"
                      >
                        {a.originalFilename || `File ${a.id}`}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="ticket-queue-footer">
              <Link to={`/tickets/${t.id}`} className="btn ghost">
                Open full ticket
              </Link>
            </div>
          </div>
        )
      })}
      <TicketPhotoEditor
        open={photoEditorSlot !== null}
        file={photoEditorSlot !== null ? photoSlots[photoEditorSlot] : null}
        onClose={() => setPhotoEditorSlot(null)}
        onSave={(f) => {
          const slot = photoEditorSlot
          setPhotoEditorSlot(null)
          if (slot !== null) setPhotoAt(slot, f)
        }}
      />
    </div>
    </RequireUser>
  )
}
