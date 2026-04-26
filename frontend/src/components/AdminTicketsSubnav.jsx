import { NavLink } from 'react-router-dom'
import { HiOutlineTicket, HiOutlineUserGroup } from 'react-icons/hi2'

export function AdminTicketsSubnav() {
  return (
    <nav className="admin-tickets-subnav" aria-label="Admin tickets sections">
      <NavLink
        end
        to="/admin/tickets"
        className={({ isActive }) =>
          `admin-tickets-subnav-link${isActive ? ' admin-tickets-subnav-link--active' : ''}`
        }
      >
        <HiOutlineTicket aria-hidden />
        Ticket desk
      </NavLink>
      <NavLink
        to="/admin/tickets/technicians"
        className={({ isActive }) =>
          `admin-tickets-subnav-link${isActive ? ' admin-tickets-subnav-link--active' : ''}`
        }
      >
        <HiOutlineUserGroup aria-hidden />
        Technicians
      </NavLink>
    </nav>
  )
}
