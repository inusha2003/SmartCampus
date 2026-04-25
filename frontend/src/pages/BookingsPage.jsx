import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { RequireUser } from '../components/RequireUser'
import { HiOutlineCalendarDays, HiOutlineCheckCircle, HiOutlineClock, HiOutlineXCircle } from 'react-icons/hi2'

function statusClass(s) {
  if (s === 'APPROVED') return 'tag ok'
  if (s === 'REJECTED' || s === 'CANCELLED') return 'tag bad'
  return 'tag warn'
}

export function BookingsPage() {
  const MAX_PURPOSE = 500
  const MAX_BOOKING_HOURS = 12
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const preselectedResourceId = searchParams.get('resourceId')
  const [bookings, setBookings] = useState([])
  const [resources, setResources] = useState([])
  const [resourceId, setResourceId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [purpose, setPurpose] = useState('')
  const [attendees, setAttendees] = useState('')
  const [editingBookingId, setEditingBookingId] = useState(null)
  const [err, setErr] = useState(null)

  const toDateTimeLocalValue = (isoString) => {
    const date = new Date(isoString)
    const offsetMs = date.getTimezoneOffset() * 60 * 1000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
  }

  const resetForm = () => {
    setResourceId('')
    setStart('')
    setEnd('')
    setPurpose('')
    setAttendees('')
    setEditingBookingId(null)
  }

  const load = async () => {
    const [{ data: b }, { data: r }] = await Promise.all([
      api.get('/api/bookings/mine'),
      api.get('/api/resources'),
    ])
    setBookings(b)
    setResources(r)
  }

  useEffect(() => {
    if (user) void load().catch(() => setErr('Failed to load bookings'))
  }, [user])

  useEffect(() => {
    if (!preselectedResourceId || resources.length === 0) return
    const exists = resources.some((r) => String(r.id) === String(preselectedResourceId) && r.status === 'ACTIVE')
    if (exists) {
      setResourceId(String(preselectedResourceId))
    }
  }, [preselectedResourceId, resources])

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (!resourceId) {
      setErr('Please select a resource.')
      return
    }
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setErr('Please provide valid start and end times.')
      return
    }
    if (endDate <= startDate) {
      setErr('End time must be after start time.')
      return
    }
    if (startDate.getTime() < Date.now()) {
      setErr('Start time cannot be in the past. Please select a future date and time.')
      return
    }
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
    if (durationHours > MAX_BOOKING_HOURS) {
      setErr(`Booking duration cannot exceed ${MAX_BOOKING_HOURS} hours.`)
      return
    }
    const purposeTrimmed = purpose.trim()
    if (purposeTrimmed.length > MAX_PURPOSE) {
      setErr(`Purpose must be at most ${MAX_PURPOSE} characters.`)
      return
    }
    const attendeesNum = attendees ? Number(attendees) : null
    if (attendeesNum != null && (!Number.isInteger(attendeesNum) || attendeesNum <= 0)) {
      setErr('Expected attendees must be a positive whole number.')
      return
    }
    const selectedResource = resources.find((r) => String(r.id) === String(resourceId))
    if (selectedResource?.capacity != null && attendeesNum != null && attendeesNum > selectedResource.capacity) {
      setErr(`Expected attendees cannot exceed resource capacity (${selectedResource.capacity}).`)
      return
    }
    try {
      if (editingBookingId) {
        await api.put(`/api/bookings/${editingBookingId}`, {
          resourceId: Number(resourceId),
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          purpose: purposeTrimmed || null,
          expectedAttendees: attendeesNum,
        })
      } else {
        await api.post('/api/bookings', {
          resourceId: Number(resourceId),
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          purpose: purposeTrimmed || null,
          expectedAttendees: attendeesNum,
        })
      }
      resetForm()
      await load()
    } catch (ex) {
      const msg = ex?.response?.data?.error
      setErr(msg || 'Request failed (overlap or invalid slot?)')
    }
  }

  const edit = (booking) => {
    setErr(null)
    setEditingBookingId(booking.id)
    setResourceId(String(booking.resourceId))
    setStart(toDateTimeLocalValue(booking.startAt))
    setEnd(toDateTimeLocalValue(booking.endAt))
    setPurpose(booking.purpose || '')
    setAttendees(booking.expectedAttendees != null ? String(booking.expectedAttendees) : '')
  }

  const cancel = async (id) => {
    setErr(null)
    try {
      await api.delete(`/api/bookings/${id}`)
      await load()
    } catch {
      setErr('Could not cancel')
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this pending request?')) return
    setErr(null)
    try {
      await api.delete(`/api/bookings/${id}/request`)
      if (editingBookingId === id) {
        resetForm()
      }
      await load()
    } catch {
      setErr('Could not delete request')
    }
  }

  return (
    <RequireUser>
    <div>
      <section className="hero-card rainbow mb-6">
        <div className="hero-grid">
          <div className="relative z-10">
            <p className="glass-chip">Booking Workflow</p>
            <h1 className="mt-3 flex items-center gap-2">
              <HiOutlineCalendarDays className="text-cyan-300" />
              <span className="gradient-title">Manage Your Reservations</span>
            </h1>
            <p className="small max-w-2xl">
              Submit requests, track approval stages, and manage confirmed slots from one
              colorful timeline-inspired dashboard.
            </p>
          </div>
          <img
            src="https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="Calendar planning board"
            className="feature-image"
          />
        </div>
      </section>

      <h1 className="flex items-center gap-2">
        <HiOutlineCalendarDays className="text-cyan-300" />
        My bookings
      </h1>
      <div className="card-grid">
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineClock className="text-amber-300" /> Pending</p>
          <p className="text-3xl font-bold metric-value">{bookings.filter((x) => x.status === 'PENDING').length}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineCheckCircle className="text-emerald-300" /> Approved</p>
          <p className="text-3xl font-bold metric-value">{bookings.filter((x) => x.status === 'APPROVED').length}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineXCircle className="text-rose-300" /> Rejected/Cancelled</p>
          <p className="text-3xl font-bold metric-value">{bookings.filter((x) => x.status === 'REJECTED' || x.status === 'CANCELLED').length}</p>
        </div>
      </div>
      <div className="card">
        <h2>{editingBookingId ? 'Edit request' : 'New request'}</h2>
        <form onSubmit={(e) => void submit(e)}>
          <div className="field">
            <label>Resource</label>
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} required>
              <option value="">Select…</option>
              {resources
                .filter((x) => x.status === 'ACTIVE')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.location}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>Start (local)</label>
            <input 
              type="datetime-local" 
              value={start} 
              onChange={(e) => setStart(e.target.value)} 
              min={new Date().toISOString().slice(0, 16)}
              required 
            />
          </div>
          <div className="field">
            <label>End (local)</label>
            <input 
              type="datetime-local" 
              value={end} 
              onChange={(e) => setEnd(e.target.value)} 
              min={start || new Date().toISOString().slice(0, 16)}
              required 
            />
          </div>
          <div className="field">
            <label>Purpose</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <div className="field">
            <label>Expected attendees</label>
            <input
              type="number"
              min={1}
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
            />
          </div>
          {err && <p className="error">{err}</p>}
          <button type="submit" className="btn primary">
            {editingBookingId ? 'Update request' : 'Submit request'}
          </button>
          {editingBookingId && (
            <button type="button" className="btn ghost ml-2" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </form>
      </div>
      <h2>Your requests</h2>
      {bookings.map((b) => (
        <div key={b.id} className="card">
          <span className={statusClass(b.status)}>{b.status}</span>
          <h2 style={{ marginTop: '0.5rem', color: 'var(--sc-navy-900)' }}>{b.resourceName}</h2>
          <p className="small">
            {new Date(b.startAt).toLocaleString()} — {new Date(b.endAt).toLocaleString()}
          </p>
          {b.purpose && <p className="small">{b.purpose}</p>}
          {b.decisionReason && <p className="small">Note: {b.decisionReason}</p>}
          {b.status === 'PENDING' && (
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => edit(b)}>
                Edit
              </button>
              <button type="button" className="btn danger" onClick={() => void remove(b.id)}>
                Delete
              </button>
            </div>
          )}
          {b.status === 'APPROVED' && (
            <div className="row-actions">
              <button type="button" className="btn danger" onClick={() => void cancel(b.id)}>
                Cancel booking
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
    </RequireUser>
  )
}
