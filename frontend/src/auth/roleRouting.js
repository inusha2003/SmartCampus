export function getDashboardPath(role) {
  if (role === 'ADMIN') return '/dashboard/admin'
  if (role === 'TECHNICIAN') return '/dashboard/technician'
  return '/dashboard/student'
}
