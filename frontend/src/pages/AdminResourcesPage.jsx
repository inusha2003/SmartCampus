import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { HiOutlineBuildingOffice2, HiOutlinePlusCircle, HiOutlineWrenchScrewdriver } from 'react-icons/hi2'

const DAY_OPTIONS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

const DAY_TOKEN_TO_DAY = {
  MON: 'MONDAY',
  MONDAY: 'MONDAY',
  TUE: 'TUESDAY',
  TUESDAY: 'TUESDAY',
  WED: 'WEDNESDAY',
  WEDNESDAY: 'WEDNESDAY',
  THU: 'THURSDAY',
  THURSDAY: 'THURSDAY',
  FRI: 'FRIDAY',
  FRIDAY: 'FRIDAY',
  SAT: 'SATURDAY',
  SATURDAY: 'SATURDAY',
  SUN: 'SUNDAY',
  SUNDAY: 'SUNDAY',
}

const DAY_LABEL = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
}

const createBlankWindowRow = () => ({ day: 'MONDAY', start: '09:00', end: '17:00' })

const toTwoDigits = (value) => value.padStart(2, '0')

const normalizeTime = (value) => {
  const m = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return `${toTwoDigits(String(hours))}:${toTwoDigits(String(minutes))}`
}

const parseWindowsToRows = (value) => {
  if (!value) return []
  const parts = value
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (!parts.length) return []

  const rows = []
  for (const part of parts) {
    const m = part.match(/^([A-Za-z]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
    if (!m) {
      return []
    }
    const normalizedDay = DAY_TOKEN_TO_DAY[m[1].toUpperCase()]
    const normalizedStart = normalizeTime(m[2])
    const normalizedEnd = normalizeTime(m[3])
    if (!normalizedDay || !normalizedStart || !normalizedEnd) {
      return []
    }
    rows.push({ day: normalizedDay, start: normalizedStart, end: normalizedEnd })
  }
  return rows
}

const serializeRowsToWindows = (rows) =>
  rows
    .filter((row) => row.day && row.start && row.end)
    .map((row) => `${DAY_LABEL[row.day]} ${row.start}-${row.end}`)
    .join('; ')

export function AdminResourcesPage() {
  const MAX_NAME = 120
  const MAX_LOCATION = 200
  const MAX_WINDOWS = 2000
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [type, setType] = useState('LECTURE_HALL')
  const [capacity, setCapacity] = useState('')
  const [location, setLocation] = useState('')
  const [windowRows, setWindowRows] = useState([createBlankWindowRow()])
  const [useCustomWindows, setUseCustomWindows] = useState(false)
  const [customWindowsText, setCustomWindowsText] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [err, setErr] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'LECTURE_HALL',
    capacity: '',
    location: '',
    status: 'ACTIVE',
  })
  const [editWindowRows, setEditWindowRows] = useState([createBlankWindowRow()])
  const [editUseCustomWindows, setEditUseCustomWindows] = useState(false)
  const [editCustomWindowsText, setEditCustomWindowsText] = useState('')

  const load = async () => {
    const { data } = await api.get('/api/resources')
    setItems(data)
  }

  useEffect(() => {
    if (user?.role === 'ADMIN') void load().catch(() => setErr('Load failed'))
  }, [user])

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />

  const create = async (e) => {
    e.preventDefault()
    setErr(null)
    const trimmedName = name.trim()
    const trimmedLocation = location.trim()
    const trimmedWindows = useCustomWindows
      ? customWindowsText.trim()
      : serializeRowsToWindows(windowRows).trim()
    const capacityNum = capacity ? Number(capacity) : null
    if (!trimmedName) {
      setErr('Name is required.')
      return
    }
    if (trimmedName.length > MAX_NAME) {
      setErr(`Name must be at most ${MAX_NAME} characters.`)
      return
    }
    if (!trimmedLocation) {
      setErr('Location is required.')
      return
    }
    if (trimmedLocation.length > MAX_LOCATION) {
      setErr(`Location must be at most ${MAX_LOCATION} characters.`)
      return
    }
    if (trimmedWindows.length > MAX_WINDOWS) {
      setErr(`Availability window must be at most ${MAX_WINDOWS} characters.`)
      return
    }
    if (capacityNum != null && (!Number.isInteger(capacityNum) || capacityNum < 0)) {
      setErr('Capacity cannot be negative.')
      return
    }
    try {
      await api.post('/api/resources', {
        name: trimmedName,
        type,
        capacity: capacityNum,
        location: trimmedLocation,
        availabilityWindows: trimmedWindows || null,
        status,
      })
      setName('')
      setCapacity('')
      setLocation('')
      setWindowRows([createBlankWindowRow()])
      setUseCustomWindows(false)
      setCustomWindowsText('')
      await load()
    } catch {
      setErr('Create failed')
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this resource?')) return
    try {
      await api.delete(`/api/resources/${id}`)
      if (editingId === id) {
        setEditingId(null)
      }
      await load()
    } catch {
      setErr('Delete failed')
    }
  }

  const startEdit = (r) => {
    setErr(null)
    const parsedRows = parseWindowsToRows(r.availabilityWindows)
    const useCustom = Boolean(r.availabilityWindows && parsedRows.length === 0)
    setEditingId(r.id)
    setEditForm({
      name: r.name ?? '',
      type: r.type ?? 'LECTURE_HALL',
      capacity: r.capacity == null ? '' : String(r.capacity),
      location: r.location ?? '',
      status: r.status ?? 'ACTIVE',
    })
    setEditWindowRows(parsedRows.length ? parsedRows : [createBlankWindowRow()])
    setEditUseCustomWindows(useCustom)
    setEditCustomWindowsText(r.availabilityWindows ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id) => {
    setErr(null)
    const trimmedName = editForm.name.trim()
    const trimmedLocation = editForm.location.trim()
    const trimmedWindows = editUseCustomWindows
      ? editCustomWindowsText.trim()
      : serializeRowsToWindows(editWindowRows).trim()
    const capacityNum = editForm.capacity === '' ? null : Number(editForm.capacity)

    if (!trimmedName) {
      setErr('Name is required.')
      return
    }
    if (trimmedName.length > MAX_NAME) {
      setErr(`Name must be at most ${MAX_NAME} characters.`)
      return
    }
    if (!trimmedLocation) {
      setErr('Location is required.')
      return
    }
    if (trimmedLocation.length > MAX_LOCATION) {
      setErr(`Location must be at most ${MAX_LOCATION} characters.`)
      return
    }
    if (trimmedWindows.length > MAX_WINDOWS) {
      setErr(`Availability window must be at most ${MAX_WINDOWS} characters.`)
      return
    }
    if (capacityNum != null && (!Number.isInteger(capacityNum) || capacityNum < 0)) {
      setErr('Capacity cannot be negative.')
      return
    }

    try {
      await api.put(`/api/resources/${id}`, {
        name: trimmedName,
        type: editForm.type,
        capacity: capacityNum,
        location: trimmedLocation,
        availabilityWindows: trimmedWindows || null,
        status: editForm.status,
      })
      setEditingId(null)
      await load()
    } catch {
      setErr('Update failed')
    }
  }

  const addWindowRow = (setter) => {
    setter((prev) => [...prev, createBlankWindowRow()])
  }

  const removeWindowRow = (setter, index) => {
    setter((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  const updateWindowRow = (setter, index, key, value) => {
    setter((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const toggleService = async (r) => {
    const next = r.status === 'ACTIVE' ? 'OUT_OF_SERVICE' : 'ACTIVE'
    try {
      await api.put(`/api/resources/${r.id}`, {
        name: r.name,
        type: r.type,
        capacity: r.capacity,
        location: r.location,
        availabilityWindows: r.availabilityWindows,
        status: next,
      })
      await load()
    } catch {
      setErr('Update failed')
    }
  }

  return (
    <div>
      <section className="hero-card rainbow mb-6">
        <div className="hero-grid">
          <div className="relative z-10">
            <p className="glass-chip">Admin Studio</p>
            <h1 className="mt-3 flex items-center gap-2">
              <HiOutlineBuildingOffice2 className="text-cyan-300" />
              <span className="gradient-title">Curate Campus Resources</span>
            </h1>
            <p className="small max-w-2xl">
              Keep facilities accurate and bookable with status controls, colorful cards, and
              fast catalog management.
            </p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1100&q=80"
            alt="Modern interior space"
            className="feature-image"
          />
        </div>
      </section>

      <h1 className="flex items-center gap-2">
        <HiOutlineBuildingOffice2 className="text-cyan-300" />
        Admin — resource catalogue
      </h1>
      <div className="card-grid">
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineBuildingOffice2 className="text-violet-300" /> Total resources</p>
          <p className="text-3xl font-bold metric-value">{items.length}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineWrenchScrewdriver className="text-rose-300" /> Out of service</p>
          <p className="text-3xl font-bold metric-value">{items.filter((x) => x.status === 'OUT_OF_SERVICE').length}</p>
        </div>
      </div>
      <div className="card">
        <h2 className="flex items-center gap-2"><HiOutlinePlusCircle className="text-cyan-300" /> Add resource</h2>
        <form onSubmit={(e) => void create(e)}>
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="LECTURE_HALL">LECTURE_HALL</option>
              <option value="LAB">LAB</option>
              <option value="MEETING_ROOM">MEETING_ROOM</option>
              <option value="EQUIPMENT">EQUIPMENT</option>
            </select>
          </div>
          <div className="field">
            <label>Capacity</label>
            <input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div className="field">
            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} required />
          </div>
          <div className="field">
            <label>Availability windows</label>
            <p className="small" style={{ marginTop: '0.25rem' }}>
              Use guided weekly slots or switch to custom text.
            </p>
            <div className="row-actions" style={{ marginBottom: '0.5rem' }}>
              <button
                type="button"
                className={`btn ${!useCustomWindows ? 'primary' : 'ghost'}`}
                onClick={() => setUseCustomWindows(false)}
              >
                Guided schedule
              </button>
              <button
                type="button"
                className={`btn ${useCustomWindows ? 'primary' : 'ghost'}`}
                onClick={() => setUseCustomWindows(true)}
              >
                Custom text
              </button>
            </div>
            {useCustomWindows ? (
              <textarea
                value={customWindowsText}
                onChange={(e) => setCustomWindowsText(e.target.value)}
                rows={3}
                placeholder="Mon 09:00-17:00; Tue 10:00-14:00"
              />
            ) : (
              <>
                {windowRows.map((row, index) => (
                  <div
                    key={`create-window-${index}`}
                    style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}
                  >
                    <div style={{ flex: '1 1 40%' }}>
                      <label>Day</label>
                      <select
                        value={row.day}
                        onChange={(e) => updateWindowRow(setWindowRows, index, 'day', e.target.value)}
                      >
                        {DAY_OPTIONS.map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: '1 1 25%' }}>
                      <label>Start</label>
                      <input
                        type="time"
                        value={row.start}
                        onChange={(e) => updateWindowRow(setWindowRows, index, 'start', e.target.value)}
                      />
                    </div>
                    <div style={{ flex: '1 1 25%' }}>
                      <label>End</label>
                      <input
                        type="time"
                        value={row.end}
                        onChange={(e) => updateWindowRow(setWindowRows, index, 'end', e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => removeWindowRow(setWindowRows, index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn ghost" onClick={() => addWindowRow(setWindowRows)}>
                  Add time slot
                </button>
              </>
            )}
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
            </select>
          </div>
          {err && <p className="error">{err}</p>}
          <button type="submit" className="btn primary">
            Create
          </button>
        </form>
      </div>
      <h2>Existing</h2>
      {items.map((r) => (
        <div key={r.id} className="card">
          <span className="tag">{r.type}</span>
          <span className={r.status === 'ACTIVE' ? 'tag ok' : 'tag bad'}>{r.status}</span>
          {editingId === r.id ? (
            <>
              <div className="field" style={{ marginTop: '0.75rem' }}>
                <label>Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value }))}
                >
                  <option value="LECTURE_HALL">LECTURE_HALL</option>
                  <option value="LAB">LAB</option>
                  <option value="MEETING_ROOM">MEETING_ROOM</option>
                  <option value="EQUIPMENT">EQUIPMENT</option>
                </select>
              </div>
              <div className="field">
                <label>Capacity</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.capacity}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, capacity: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Location</label>
                <input
                  value={editForm.location}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Availability windows</label>
                <p className="small" style={{ marginTop: '0.25rem' }}>
                  Use guided weekly slots or switch to custom text.
                </p>
                <div className="row-actions" style={{ marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${!editUseCustomWindows ? 'primary' : 'ghost'}`}
                    onClick={() => setEditUseCustomWindows(false)}
                  >
                    Guided schedule
                  </button>
                  <button
                    type="button"
                    className={`btn ${editUseCustomWindows ? 'primary' : 'ghost'}`}
                    onClick={() => setEditUseCustomWindows(true)}
                  >
                    Custom text
                  </button>
                </div>
                {editUseCustomWindows ? (
                  <textarea
                    value={editCustomWindowsText}
                    onChange={(e) => setEditCustomWindowsText(e.target.value)}
                    rows={3}
                    placeholder="Mon 09:00-17:00; Tue 10:00-14:00"
                  />
                ) : (
                  <>
                    {editWindowRows.map((row, index) => (
                      <div
                        key={`edit-window-${index}`}
                        style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}
                      >
                        <div style={{ flex: '1 1 40%' }}>
                          <label>Day</label>
                          <select
                            value={row.day}
                            onChange={(e) => updateWindowRow(setEditWindowRows, index, 'day', e.target.value)}
                          >
                            {DAY_OPTIONS.map((day) => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: '1 1 25%' }}>
                          <label>Start</label>
                          <input
                            type="time"
                            value={row.start}
                            onChange={(e) => updateWindowRow(setEditWindowRows, index, 'start', e.target.value)}
                          />
                        </div>
                        <div style={{ flex: '1 1 25%' }}>
                          <label>End</label>
                          <input
                            type="time"
                            value={row.end}
                            onChange={(e) => updateWindowRow(setEditWindowRows, index, 'end', e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => removeWindowRow(setEditWindowRows, index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => addWindowRow(setEditWindowRows)}
                    >
                      Add time slot
                    </button>
                  </>
                )}
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                </select>
              </div>
              <div className="row-actions">
                <button type="button" className="btn primary" onClick={() => void saveEdit(r.id)}>
                  Save
                </button>
                <button type="button" className="btn ghost" onClick={cancelEdit}>
                  Cancel
                </button>
                <button type="button" className="btn danger" onClick={() => void remove(r.id)}>
                  Delete
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: '0.5rem', color: 'var(--sc-navy-900)' }}>{r.name}</h2>
              <p className="small">{r.location}</p>
              {r.availabilityWindows && <p className="small">Hours: {r.availabilityWindows}</p>}
              <div className="row-actions">
                <button type="button" className="btn primary" onClick={() => startEdit(r)}>
                  Edit
                </button>
                <button type="button" className="btn ghost" onClick={() => void toggleService(r)}>
                  Toggle active / out of service
                </button>
                <button type="button" className="btn danger" onClick={() => void remove(r.id)}>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
