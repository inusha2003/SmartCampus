import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  HiOutlineArrowTrendingUp,
  HiOutlineBuildingOffice2,
  HiOutlineFunnel,
  HiOutlineMapPin,
  HiOutlineUsers,
} from 'react-icons/hi2'

const splitAvailabilityWindows = (value) =>
  (value || '')
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)

const sanitizeLocationInput = (value) => value.replace(/[^a-zA-Z0-9\s-]/g, '')
const sanitizeMinCapacityInput = (value) => {
  if (!value) return ''
  const numericValue = Number.parseInt(value, 10)
  if (Number.isNaN(numericValue)) return ''
  return String(Math.min(Math.max(numericValue, 0), 1000))
}

export function CataloguePage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [type, setType] = useState('')
  const [location, setLocation] = useState('')
  const [minCap, setMinCap] = useState('')
  const [err, setErr] = useState(null)

  const load = async () => {
    setErr(null)
    try {
      const params = {}
      if (type) params.type = type
      if (location.trim()) params.location = location.trim()
      if (minCap) params.minCapacity = minCap
      const { data } = await api.get('/api/resources', { params })
      setItems(data)
    } catch {
      setErr('Could not load catalogue.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleResourceClick = (resourceId) => {
    if (authLoading) return
    if (user) {
      navigate(`/bookings?resourceId=${resourceId}`)
      return
    }
    navigate('/login')
  }

  return (
    <div>
      <section
        className="hero-card hero-cover mb-6"
        style={{
          backgroundImage:
            "linear-gradient(104deg, rgba(4, 9, 19, 0.9) 0%, rgba(6, 14, 28, 0.76) 42%, rgba(7, 17, 32, 0.42) 75%), url('https://images.unsplash.com/photo-1537202108838-e7072bad1927?auto=format&fit=crop&w=1800&q=80')",
        }}
      >
        <div className="hero-cover-content">
          <p className="tag">Smart Campus Experience</p>
          <h1 className="mt-3 flex items-center gap-2">
            <HiOutlineBuildingOffice2 className="text-cyan-300" />
            Book Spaces With Confidencee
          </h1>
          <p className="small max-w-2xl">
            Discover lecture halls, labs, and equipment in one colorful dashboard. Filter quickly,
            view availability, and submit requests with a clean modern experience.
          </p>
          <div className="row-actions mt-4">
            <button type="button" className="btn primary" onClick={() => void load()}>
              <HiOutlineArrowTrendingUp />
              Refresh Catalogue
            </button>
          </div>
        </div>
      </section>

      <h1 className="flex items-center gap-2">
        <HiOutlineBuildingOffice2 className="text-cyan-300" />
        Facilities &amp; assets
      </h1>
      <p className="small">
        Browse bookable rooms, labs, and equipment. Sign in to request a booking.
      </p>
      <div className="stats-grid">
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineBuildingOffice2 className="text-cyan-300" /> Total resources</p>
          <p className="text-3xl font-bold metric-value">{items.length}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineUsers className="text-violet-300" /> Capacity aware</p>
          <p className="text-3xl font-bold metric-value">{items.filter((x) => x.capacity != null).length}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineMapPin className="text-emerald-300" /> Distinct locations</p>
          <p className="text-3xl font-bold metric-value">{new Set(items.map((x) => x.location)).size}</p>
        </div>
      </div>
      <div className="card">
        <div className="field" style={{ maxWidth: '100%' }}>
          <label className="flex items-center gap-2"><HiOutlineFunnel /> Filters</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div>
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Any</option>
                <option value="LECTURE_HALL">Lecture hall</option>
                <option value="LAB">Lab</option>
                <option value="MEETING_ROOM">Meeting room</option>
                <option value="EQUIPMENT">Equipment</option>
              </select>
            </div>
            <div>
              <label>Location contains</label>
              <input
                value={location}
                onChange={(e) => setLocation(sanitizeLocationInput(e.target.value))}
                placeholder="e.g. Block A"
              />
            </div>
            <div>
              <label>Min. capacity</label>
              <input
                type="number"
                min={0}
                max={1000}
                value={minCap}
                onChange={(e) => setMinCap(sanitizeMinCapacityInput(e.target.value))}
                placeholder="—"
              />
            </div>
            <button type="button" className="btn primary" onClick={() => void load()}>
              Apply
            </button>
          </div>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card-grid">
        {items.map((r) => (
          <div
            key={r.id}
            className="card cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => handleResourceClick(r.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleResourceClick(r.id)
              }
            }}
            title={
              authLoading
                ? 'Checking session…'
                : user
                  ? 'Click to book this resource'
                  : 'Sign in to book this resource'
            }
          >
            <span className="tag">{r.type.replaceAll('_', ' ')}</span>
            {r.status !== 'ACTIVE' && <span className="tag bad">Out of service</span>}
            <h2 style={{ marginTop: '0.65rem', color: 'var(--sc-navy-900)' }}>{r.name}</h2>
            <p className="small">{r.location}</p>
            {r.capacity != null && <p className="small">Capacity: {r.capacity}</p>}
            {r.availabilityWindows && (
              <div className="small" style={{ marginTop: '0.25rem' }}>
                <p style={{ margin: 0 }}>Hours:</p>
                {splitAvailabilityWindows(r.availabilityWindows).map((line, index) => (
                  <p key={`${r.id}-hours-${index}`} style={{ margin: '0.125rem 0 0' }}>
                    {line}
                  </p>
                ))}
              </div>
            )}
            <p className="small" style={{ marginTop: '0.6rem', fontWeight: 700 }}>
              {authLoading ? 'Checking session…' : user ? 'Book this resource' : 'Sign in to book'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
