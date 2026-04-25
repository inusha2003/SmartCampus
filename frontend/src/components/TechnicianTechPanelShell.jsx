import { NavLink } from 'react-router-dom'
import { HiBolt, HiSquares2X2, HiClipboardDocumentCheck, HiPhoto } from 'react-icons/hi2'

/**
 * Shared TechPanel frame (sidebar + main column) for technician dashboard and tasks views.
 */
export function TechnicianTechPanelShell({ children }) {
  return (
    <div className="tech-panel-root">
      <aside className="tech-panel-sidebar">
        <div className="tech-panel-brand">
          <span className="tech-panel-brand-icon" aria-hidden>
            <HiBolt />
          </span>
          <div>
            <div className="tech-panel-brand-title">TechPanel</div>
            <div className="tech-panel-brand-sub">Campus operations</div>
          </div>
        </div>
        <nav className="tech-panel-nav" aria-label="Technician panel">
          <NavLink
            end
            to="/dashboard/technician"
            className={({ isActive }) => `tech-panel-nav-item${isActive ? ' is-active' : ''}`}
          >
            <HiSquares2X2 className="tech-panel-nav-ico" aria-hidden />
            Dashboard
          </NavLink>
          <NavLink to="/tickets" className={({ isActive }) => `tech-panel-nav-item${isActive ? ' is-active' : ''}`}>
            <HiClipboardDocumentCheck className="tech-panel-nav-ico" aria-hidden />
            Tasks
          </NavLink>
          <NavLink
            to="/technician/settlements"
            className={({ isActive }) => `tech-panel-nav-item${isActive ? ' is-active' : ''}`}
          >
            <HiPhoto className="tech-panel-nav-ico" aria-hidden />
            Settlements
          </NavLink>
        </nav>
      </aside>
      <div className="tech-panel-main">{children}</div>
    </div>
  )
}
