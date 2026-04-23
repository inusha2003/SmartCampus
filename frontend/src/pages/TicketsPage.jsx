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
  HiOutlineTrash,
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

/**
 * Map free-text title to a related incident. First matching rule wins; values must match
 * RELATED_INCIDENT_TYPES.
 */
const TITLE_TO_INCIDENT_RULES = [
  {
    incident: 'Fire',
    patterns: [/\bfire\b/i, /smoke/i, /extinguisher/i, /sprinkler/i, /flammable/i],
  },
  {
    incident: 'Electrical Issues',
    patterns: [
      /\belectric/i,
      /\bpower\b/i,
      /blackout/i,
      /outlet/i,
      /\bsocket\b/i,
      /wiring/i,
      /\bfuse\b/i,
      /circuit\b/i,
      /breaker/i,
      /\blights?\b.*(flicker|broken)/i,
    ],
  },
  {
    incident: 'IT Support',
    patterns: [
      /\bit\b/i,
      /computer/i,
      /laptop/i,
      /\bpc\b/i,
      /wi-?fi/i,
      /\bnetwork\b/i,
      /printer/i,
      /\bemail\b/i,
      /login/i,
      /password/i,
      /software/i,
      /projector/i,
      /antivirus/i,
      /server/i,
      /lab\s*(pc|computer)/i,
    ],
  },
  {
    incident: 'Cleaning and Waste',
    patterns: [
      /clean(ing)?/i,
      /trash|garbage|rubbish|waste/i,
      /\btoilet\b/i,
      /\brestroom\b/i,
      /spill/i,
      /\bsmell/i,
      /hygiene/i,
    ],
  },
  {
    incident: 'Maintenance',
    patterns: [
      /maintenance/i,
      /\bac\b/i,
      /air\s*condition/i,
      /plumb/i,
      /leak/i,
      /\bdoor\b/i,
      /\bwindow\b/i,
      /furniture/i,
      /broken/i,
      /repair/i,
    ],
  },
]

function inferIncidentFromTitle(text) {
  const s = text.trim()
  if (!s) return ''
  for (const { incident, patterns } of TITLE_TO_INCIDENT_RULES) {
    if (!RELATED_INCIDENT_TYPES.includes(incident)) continue
    if (patterns.some((re) => re.test(s))) return incident
  }
  return ''
}

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

/** Contact / full name: Unicode letters, spaces, period, apostrophe, hyphen. */
const NAME_LETTERS_ONLY_RE = /^[\p{L}\s'.-]+$/u
/** Digits only, exactly 10 (e.g. Sri Lanka mobile 07XXXXXXXX). */
const PHONE_DIGITS_ONLY_RE = /^\d{10}$/
/** Allowed characters in contact email (typing + stored value). Dot is required for domains like .com */
const EMAIL_ALLOWED_CHARS_RE = /^[\p{L}\p{N}@.]+$/u

const MIN_TITLE_LEN = 3

function runTicketFormValidation({
  relatedIncident,
  title,
  locationSelect,
  locationOther,
  description,
  contactName,
  contactEmail,
  contactPhone,
  maxTitle,
  maxLocation,
  maxDescription,
  maxEmail,
  maxName,
}) {
  /** @type {Record<string, string>} */
  const errors = {}
  if (!relatedIncident?.trim()) errors.relatedIncident = 'Select a related incident.'
  const tit = title.trim()
  if (!tit) errors.title = 'Title is required.'
  else if (tit.length < MIN_TITLE_LEN) errors.title = `Title must be at least ${MIN_TITLE_LEN} characters.`
  else if (tit.length > maxTitle) errors.title = `Title must be at most ${maxTitle} characters.`

  const trimmedLoc =
    locationSelect === LOCATION_OTHER ? locationOther.trim() : locationSelect.trim()
  if (!locationSelect) errors.location = 'Select a campus location.'
  else if (!trimmedLoc) {
    if (locationSelect === LOCATION_OTHER) errors.locationOther = 'Describe the location.'
    else errors.location = 'Select a campus location.'
  } else if (trimmedLoc.length > maxLocation) errors.location = `Location must be at most ${maxLocation} characters.`

  const desc = stripWhitespaceForTicketDescription(description, maxDescription)
  if (!desc) errors.description = 'Description is required.'
  else if (desc.length > maxDescription) {
    errors.description = `Description must be at most ${maxDescription} characters.`
  }

  const name = contactName.trim()
  if (!name) errors.contactName = 'Contact name is required.'
  else if (name.length > maxName) errors.contactName = `Name must be at most ${maxName} characters.`
  else if (!NAME_LETTERS_ONLY_RE.test(name)) {
    errors.contactName = 'Use only letters, spaces, and . \' - (no numbers).'
  }

  const email = contactEmail.trim()
  if (!email) errors.contactEmail = 'Contact email is required.'
  else if (email.length > maxEmail) errors.contactEmail = `Email must be at most ${maxEmail} characters.`
  else if (!EMAIL_ALLOWED_CHARS_RE.test(email)) {
    errors.contactEmail = 'Only letters, numbers, @ and . (full stop) are allowed.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.contactEmail = 'Enter a valid email address.'

  const phone = contactPhone.trim()
  if (!phone) errors.contactPhone = 'Contact phone is required.'
  else if (!PHONE_DIGITS_ONLY_RE.test(phone)) {
    errors.contactPhone = 'Enter exactly 10 digits (no spaces or symbols).'
  }

  return errors
}

/**
 * Strip Unicode whitespace to match backend `Character.isWhitespace` rules on descriptions.
 * (Broader than `/\s/g`, which can miss some code points browsers allow in pasted text.)
 */
function stripWhitespaceForTicketDescription(s, maxLen) {
  const cleaned = String(s ?? '').replace(/\p{White_Space}/gu, '')
  return cleaned.slice(0, maxLen)
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

function mapLocationToForm(locationText) {
  const raw = (locationText || '').trim()
  if (!raw) return { locationSelect: '', locationOther: '' }
  if (SLIIT_LOCATIONS.includes(raw)) return { locationSelect: raw, locationOther: '' }
  return { locationSelect: LOCATION_OTHER, locationOther: raw }
}

function canReporterEditTicket(t, userId) {
  if (userId == null || t == null) return false
  if (Number(t.reporterId) !== Number(userId)) return false
  return t.status === 'OPEN' || t.status === 'IN_PROGRESS'
}

export function TicketsPage() {
  const MAX_CATEGORY = 120
  const MAX_TITLE = 200
  const MAX_LOCATION = 500
  const MAX_DESCRIPTION = 150
  const MAX_CONTACT_EMAIL = 254
  const MAX_CONTACT_NAME = 120
  const MAX_CONTACT_PHONE_DIGITS = 10
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [title, setTitle] = useState('')
  const [relatedIncident, setRelatedIncident] = useState('')
  const [locationSelect, setLocationSelect] = useState('')
  const [locationOther, setLocationOther] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [fieldErrors, setFieldErrors] = useState(() => ({}))
  const [photoSlots, setPhotoSlots] = useState(() =>
    Array.from({ length: MAX_TICKET_PHOTOS }, () => null),
  )
  const [photoEditorSlot, setPhotoEditorSlot] = useState(null)
  const [editingTicketId, setEditingTicketId] = useState(null)
  const [replaceAttachments, setReplaceAttachments] = useState(false)
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

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const load = async () => {
    const { data: t } = await api.get('/api/tickets')
    setTickets(t)
  }

  useEffect(() => {
    if (user) void load().catch(() => setErr('Failed to load tickets'))
  }, [user])

  const resetFormToNew = () => {
    setEditingTicketId(null)
    setReplaceAttachments(false)
    setDescription('')
    setTitle('')
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setPhotoSlots(Array.from({ length: MAX_TICKET_PHOTOS }, () => null))
    setRelatedIncident('')
    setLocationSelect('')
    setLocationOther('')
    setPriority('MEDIUM')
    setFieldErrors({})
    setErr(null)
  }

  const beginEditTicket = (t) => {
    const { locationSelect: ls, locationOther: lo } = mapLocationToForm(t.locationText)
    setLocationSelect(ls)
    setLocationOther(lo)
    setTitle(t.title || '')
    setRelatedIncident(t.category || '')
    setDescription(stripWhitespaceForTicketDescription(t.description || '', MAX_DESCRIPTION))
    setPriority(t.priority || 'MEDIUM')
    setContactName(t.contactName || '')
    setContactEmail(t.contactEmail || '')
    setContactPhone(String(t.contactPhone || '').replace(/\D/g, '').slice(0, MAX_CONTACT_PHONE_DIGITS))
    setPhotoSlots(Array.from({ length: MAX_TICKET_PHOTOS }, () => null))
    setReplaceAttachments(false)
    setEditingTicketId(t.id)
    setFieldErrors({})
    setErr(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteTicket = async (t) => {
    if (!canReporterEditTicket(t, user?.id)) return
    if (!window.confirm(`Delete ticket #${t.id}? This cannot be undone.`)) return
    setErr(null)
    try {
      await api.delete(`/api/tickets/${t.id}`)
      if (editingTicketId === t.id) resetFormToNew()
      await load()
    } catch {
      setErr('Could not delete ticket.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    const trimmedIncident = relatedIncident.trim()
    if (trimmedIncident.length > MAX_CATEGORY) {
      setFieldErrors({ relatedIncident: `Category value is too long.` })
      setErr('Fix the highlighted fields.')
      return
    }

    const nextErrors = runTicketFormValidation({
      relatedIncident,
      title,
      locationSelect,
      locationOther,
      description,
      contactName,
      contactEmail,
      contactPhone,
      maxTitle: MAX_TITLE,
      maxLocation: MAX_LOCATION,
      maxDescription: MAX_DESCRIPTION,
      maxEmail: MAX_CONTACT_EMAIL,
      maxName: MAX_CONTACT_NAME,
    })
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setErr('Please fix the highlighted fields below.')
      return
    }
    setFieldErrors({})

    const trimmedLocation =
      locationSelect === LOCATION_OTHER ? locationOther.trim() : locationSelect.trim()
    const trimmedTitle = title.trim()
    const trimmedDescription = stripWhitespaceForTicketDescription(description, MAX_DESCRIPTION)
    const trimmedEmail = contactEmail.trim()
    const trimmedPhone = contactPhone.trim()
    const trimmedContactName = contactName.trim()

    const attachedPhotos = photoSlots.filter(Boolean)
    if (attachedPhotos.length > MAX_TICKET_PHOTOS) {
      setErr('Maximum 3 images are allowed.')
      return
    }
    if (editingTicketId != null && replaceAttachments && attachedPhotos.length > MAX_TICKET_PHOTOS) {
      setErr('Maximum 3 images are allowed.')
      return
    }

    const fd = new FormData()
    fd.append('locationText', trimmedLocation)
    fd.append('title', trimmedTitle)
    fd.append('category', trimmedIncident)
    fd.append('description', trimmedDescription)
    fd.append('priority', priority)
    fd.append('contactName', trimmedContactName)
    fd.append('contactEmail', trimmedEmail)
    fd.append('contactPhone', trimmedPhone)

    const isEdit = editingTicketId != null
    if (isEdit) {
      fd.append('replaceAttachments', replaceAttachments ? 'true' : 'false')
      if (replaceAttachments) {
        for (const f of attachedPhotos) {
          fd.append('files', f)
        }
      }
    } else {
      for (const f of attachedPhotos) {
        fd.append('files', f)
      }
    }

    try {
      if (isEdit) {
        try {
          await api.post(`/api/tickets/${editingTicketId}/reporter`, fd)
        } catch (first) {
          // Older API builds only have PATCH /api/tickets/{id} (multipart); POST …/reporter returns 404.
          if (first?.response?.status === 404) {
            await api.patch(`/api/tickets/${editingTicketId}`, fd)
          } else {
            throw first
          }
        }
      } else {
        await api.post('/api/tickets', fd)
      }
      resetFormToNew()
      await load()
    } catch (e) {
      const d = e?.response?.data
      let backend = ''
      if (d && typeof d === 'object') {
        if (typeof d.error === 'string') backend = d.error
        else if (typeof d.message === 'string') backend = d.message
      }
      setErr(
        backend ||
          (isEdit
            ? 'Could not update ticket (check fields and images).'
            : 'Could not create ticket (max 3 images, check fields).'),
      )
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
        <h2>{editingTicketId != null ? `Edit ticket #${editingTicketId}` : 'Report an issue'}</h2>
        {editingTicketId != null ? (
          <p className="small mb-3 max-w-[640px]">
            Update your details below. Photos stay the same unless you turn on <strong>Replace photos</strong>.
          </p>
        ) : null}
        <form onSubmit={(e) => void submit(e)} noValidate>
          <div className={`field${fieldErrors.relatedIncident ? ' field-invalid' : ''}`}>
            <label>Related incident</label>
            <select
              value={relatedIncident}
              onChange={(e) => {
                setRelatedIncident(e.target.value)
                clearFieldError('relatedIncident')
              }}
            >
              <option value="">Select incident</option>
              {RELATED_INCIDENT_TYPES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {fieldErrors.relatedIncident ? <p className="field-error">{fieldErrors.relatedIncident}</p> : null}
          </div>
          <div className={`field${fieldErrors.title ? ' field-invalid' : ''}`}>
            <label>Title</label>
            <input
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => {
                const v = e.target.value
                setTitle(v)
                clearFieldError('title')
                const guess = inferIncidentFromTitle(v)
                if (guess) setRelatedIncident(guess)
              }}
              placeholder="e.g. WiFi not working in library, broken AC in hall…"
              aria-describedby="ticket-title-hint"
            />
            {fieldErrors.title ? <p className="field-error">{fieldErrors.title}</p> : null}
            <p id="ticket-title-hint" className="small mt-1 max-w-[440px]">
              Required. Keywords here can auto-select <strong>Related incident</strong> above (you can still change
              the category manually).
            </p>
          </div>
          <div className={`field${fieldErrors.location || fieldErrors.locationOther ? ' field-invalid' : ''}`}>
            <label>Location / area</label>
            <select
              value={locationSelect}
              onChange={(e) => {
                const v = e.target.value
                setLocationSelect(v)
                if (v !== LOCATION_OTHER) setLocationOther('')
                clearFieldError('location')
                clearFieldError('locationOther')
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
            {fieldErrors.location ? <p className="field-error">{fieldErrors.location}</p> : null}
            {locationSelect === LOCATION_OTHER && (
              <input
                className="mt-2"
                value={locationOther}
                onChange={(e) => {
                  setLocationOther(e.target.value)
                  clearFieldError('locationOther')
                  clearFieldError('location')
                }}
                placeholder="e.g. room number or area not listed"
                aria-label="Custom location description"
              />
            )}
            {fieldErrors.locationOther ? <p className="field-error">{fieldErrors.locationOther}</p> : null}
          </div>
          <div className={`field${fieldErrors.description ? ' field-invalid' : ''}`}>
            <label>Description</label>
            <textarea
              value={description}
              maxLength={MAX_DESCRIPTION}
              onChange={(e) => {
                const v = stripWhitespaceForTicketDescription(e.target.value, MAX_DESCRIPTION)
                setDescription(v)
                clearFieldError('description')
              }}
              rows={4}
              spellCheck="true"
              aria-describedby="ticket-description-hint"
            />
            {fieldErrors.description ? <p className="field-error">{fieldErrors.description}</p> : null}
            <p id="ticket-description-hint" className="small mt-1 max-w-[440px]">
              No spaces. Maximum {MAX_DESCRIPTION} characters ({description.length}/{MAX_DESCRIPTION}).
            </p>
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
          <div className={`field${fieldErrors.contactName ? ' field-invalid' : ''}`}>
            <label>Contact name</label>
            <input
              value={contactName}
              maxLength={MAX_CONTACT_NAME}
              autoComplete="name"
              onChange={(e) => {
                const v = e.target.value.replace(/[^\p{L}\s'.-]/gu, '')
                setContactName(v)
                clearFieldError('contactName')
              }}
              placeholder="e.g. Kamal Perera"
              aria-describedby="ticket-contact-name-hint"
            />
            {fieldErrors.contactName ? <p className="field-error">{fieldErrors.contactName}</p> : null}
            <p id="ticket-contact-name-hint" className="small mt-1 max-w-[440px]">
              {"Letters only (any language). Spaces and . ' - are allowed. No numbers."}
            </p>
          </div>
          <div className={`field${fieldErrors.contactEmail ? ' field-invalid' : ''}`}>
            <label>Contact email</label>
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              value={contactEmail}
              maxLength={MAX_CONTACT_EMAIL}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\p{L}\p{N}@.]/gu, '')
                setContactEmail(v)
                clearFieldError('contactEmail')
              }}
              placeholder="e.g. name@gmail.com"
              aria-describedby="ticket-contact-email-hint"
            />
            {fieldErrors.contactEmail ? <p className="field-error">{fieldErrors.contactEmail}</p> : null}
            <p id="ticket-contact-email-hint" className="small mt-1 max-w-[440px]">
              Only letters, numbers, @ and . (no spaces or other symbols).
            </p>
          </div>
          <div className={`field${fieldErrors.contactPhone ? ' field-invalid' : ''}`}>
            <label>Contact phone</label>
            <input
              inputMode="numeric"
              autoComplete="tel"
              maxLength={MAX_CONTACT_PHONE_DIGITS}
              value={contactPhone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, MAX_CONTACT_PHONE_DIGITS)
                setContactPhone(digits)
                clearFieldError('contactPhone')
              }}
              placeholder="e.g. 0771234567"
            />
            {fieldErrors.contactPhone ? <p className="field-error">{fieldErrors.contactPhone}</p> : null}
            <p className="small mt-1 max-w-[440px]">Exactly 10 digits (no spaces or +), e.g. 0771234567.</p>
          </div>
          {editingTicketId != null ? (
            <div className="field">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={replaceAttachments}
                  onChange={(e) => {
                    setReplaceAttachments(e.target.checked)
                    if (!e.target.checked) {
                      setPhotoSlots(Array.from({ length: MAX_TICKET_PHOTOS }, () => null))
                    }
                  }}
                />
                <span>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#c6d7ff]">
                    Replace photos
                  </span>
                  <span className="small block text-[#b7c9f1]">
                    Removes current ticket images. Then add up to 3 new photos in the slots below, or leave
                    all empty for no images.
                  </span>
                </span>
              </label>
            </div>
          ) : null}
          <div className={`field${editingTicketId != null && !replaceAttachments ? ' opacity-60' : ''}`}>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#c6d7ff]">
              Images (max 3)
            </span>
            <p className="small mb-3 max-w-[640px]">
              {editingTicketId != null && !replaceAttachments
                ? 'Existing photos are kept. Turn on Replace photos above to change them.'
                : 'Optional — use each slot for one photo. You can submit with any number of slots filled (0–3).'}
            </p>
            <div
              className={`ticket-photo-slots${editingTicketId != null && !replaceAttachments ? ' pointer-events-none select-none' : ''}`}
              aria-live="polite"
            >
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
          <div className="row-actions">
            <button type="submit" className="btn primary">
              {editingTicketId != null ? 'Update ticket' : 'Submit ticket'}
            </button>
            {editingTicketId != null ? (
              <button type="button" className="btn ghost" onClick={() => resetFormToNew()}>
                Cancel edit
              </button>
            ) : null}
          </div>
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
              {t.title?.trim() ? (
                <div className="ticket-queue-meta-row ticket-queue-meta-row-wide">
                  <dt>Title</dt>
                  <dd>{t.title.trim()}</dd>
                </div>
              ) : null}
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
              {t.contactName?.trim() ? (
                <div className="ticket-queue-meta-row">
                  <dt>Contact name</dt>
                  <dd>{t.contactName.trim()}</dd>
                </div>
              ) : null}
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
              {canReporterEditTicket(t, user?.id) ? (
                <>
                  <button type="button" className="btn ghost" onClick={() => beginEditTicket(t)}>
                    <HiOutlinePencilSquare className="inline h-4 w-4 align-text-bottom" aria-hidden />
                    <span className="ml-1">Edit</span>
                  </button>
                  <button type="button" className="btn danger" onClick={() => void deleteTicket(t)}>
                    <HiOutlineTrash className="inline h-4 w-4 align-text-bottom" aria-hidden />
                    <span className="ml-1">Delete</span>
                  </button>
                </>
              ) : null}
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
