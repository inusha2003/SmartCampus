import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  HiOutlineBell,
  HiOutlineCalendarDays,
  HiOutlineClipboardDocumentList,
  HiOutlineSquares2X2,
  HiOutlineWrenchScrewdriver,
} from 'react-icons/hi2'
import { Footer } from './Footer'
import './layout.css'

export function Layout() {
  const { user, loading, logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link to="/" className="brand">
          <img
            src="/smart-campus-logo.jpg"
            alt="Smart Campus Hub logo"
            className="brand-logo"
            loading="eager"
          />
          <span>Smart Campus Hub</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>
            <HiOutlineSquares2X2 />
            Catalogue
          </NavLink>
          {user && (
            <>
              <NavLink to="/bookings">
                <HiOutlineCalendarDays />
                My bookings
              </NavLink>
              <NavLink to="/tickets">
                <HiOutlineWrenchScrewdriver />
                Tickets
              </NavLink>
              <NavLink to="/notifications">
                <HiOutlineBell />
                Notifications
              </NavLink>
              {user.role === 'ADMIN' && (
                <>
                  <NavLink to="/admin/bookings">
                    <HiOutlineClipboardDocumentList />
                    Admin: bookings
                  </NavLink>
                  <NavLink to="/admin/resources">
                    <HiOutlineSquares2X2 />
                    Admin: resources
                  </NavLink>
                </>
              )}
            </>
          )}
        </nav>
        <div className="nav-user">
          {loading ? (
            <span className="muted">…</span>
          ) : user ? (
            <>
              <span className="user-pill" title={user.email}>
                {user.displayName}
                <small>{user.role}</small>
              </span>
              <button type="button" className="btn ghost" onClick={() => void logout()}>
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn primary">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
