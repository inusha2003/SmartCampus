import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { HiOutlineExclamationTriangle, HiOutlinePhoto, HiOutlineTicket, HiOutlineWrenchScrewdriver } from 'react-icons/hi2'

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
  const [resources, setResources] = useState([])
  const [resourceId, setResourceId] = useState('')
  const [locationText, setLocationText] = useState('')
  const [category, setCategory] = useState('FACILITIES')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [files, setFiles] = useState(null)
  const [err, setErr] = useState(null)

  const load = async () => {
    const [{ data: t }, { data: r }] = await Promise.all([
      api.get('/api/tickets'),
      api.get('/api/resources'),
    ])
    setTickets(t)
    setResources(r)
  }

  useEffect(() => {
    if (user) void load().catch(() => setErr('Failed to load tickets'))
  }, [user])

  if (!user) return <Navigate to="/login" replace />

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    const trimmedLocation = locationText.trim()
    const trimmedCategory = category.trim()
    const trimmedDescription = description.trim()
    const trimmedEmail = contactEmail.trim()
    const trimmedPhone = contactPhone.trim()
    if (!resourceId && !trimmedLocation) {
      setErr('Choose a related resource or provide a location/area.')
      return
    }
    if (!trimmedCategory) {
      setErr('Category is required.')
      return
    }
    if (trimmedCategory.length > MAX_CATEGORY) {
      setErr(`Category must be at most ${MAX_CATEGORY} characters.`)
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
    if (files && files.length > 3) {
      setErr('Maximum 3 images are allowed.')
      return
    }
    const fd = new FormData()
    if (resourceId) fd.append('resourceId', resourceId)
    if (trimmedLocation) fd.append('locationText', trimmedLocation)
    fd.append('category', trimmedCategory)
    fd.append('description', trimmedDescription)
    fd.append('priority', priority)
    if (trimmedEmail) fd.append('contactEmail', trimmedEmail)
    if (trimmedPhone) fd.append('contactPhone', trimmedPhone)
    if (files) {
      for (let i = 0; i < Math.min(files.length, 3); i++) {
        fd.append('files', files[i])
      }
    }
    try {
      await api.post('/api/tickets', fd)
      setDescription('')
      setFiles(null)
      await load()
    } catch {
      setErr('Could not create ticket (max 3 images, check fields).')
    }
  }

  return (
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
            <label>Related resource (optional)</label>
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">—</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Location / area (if no resource)</label>
            <input value={locationText} onChange={(e) => setLocationText(e.target.value)} />
          </div>
          <div className="field">
            <label>Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} required />
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
            <label>Images (max 3)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
          </div>
          {err && <p className="error">{err}</p>}
          <button type="submit" className="btn primary">
            Submit ticket
          </button>
        </form>
      </div>
      <h2>Your tickets &amp; queue</h2>
      {tickets.map((t) => (
        <div key={t.id} className="card">
          <span className="tag">{t.status.replaceAll('_', ' ')}</span>
          <span className="tag warn">{t.priority}</span>
          <h2 style={{ marginTop: '0.5rem', color: 'var(--sc-navy-900)' }}>
            <Link to={`/tickets/${t.id}`} style={{ color: 'inherit' }}>
              #{t.id} — {t.category}
            </Link>
          </h2>
          <p className="small">
            {t.description.slice(0, 160)}
            {t.description.length > 160 ? '…' : ''}
          </p>
        </div>
      ))}
    </div>
  )
}
