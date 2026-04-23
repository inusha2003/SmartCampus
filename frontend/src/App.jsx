import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { AdminBookingsPage } from './pages/AdminBookingsPage'
import { AdminResourcesPage } from './pages/AdminResourcesPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { BookingsPage } from './pages/BookingsPage'
import { CataloguePage } from './pages/CataloguePage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ProfilePage } from './pages/ProfilePage'
import { RoleHomePage } from './pages/RoleHomePage'
import { SignupPage } from './pages/SignupPage'
import { StudentDashboardPage } from './pages/StudentDashboardPage'
import { TechnicianDashboardPage } from './pages/TechnicianDashboardPage'
import { TicketDetailPage } from './pages/TicketDetailPage'
import { TicketsPage } from './pages/TicketsPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<RoleHomePage />} />
            <Route path="/catalogue" element={<CataloguePage />} />
            <Route path="/dashboard/admin" element={<AdminDashboardPage />} />
            <Route path="/dashboard/student" element={<StudentDashboardPage />} />
            <Route path="/dashboard/technician" element={<TechnicianDashboardPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/admin/bookings" element={<AdminBookingsPage />} />
            <Route path="/admin/resources" element={<AdminResourcesPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
