import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, fetchCsrf } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
    HiOutlineShieldCheck,
    HiOutlineUserGroup,
    HiOutlineUserPlus,
    HiOutlineUsers,
} from 'react-icons/hi2'

export function AdminUsersPage() {
    const { user, loading: authLoading } = useAuth()
    const [users, setUsers] = useState([])
    const [err, setErr] = useState(null)
    const [filter, setFilter] = useState('')
    const [search, setSearch] = useState('')
    const [newEmail, setNewEmail] = useState('')
    const [newName, setNewName] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [newRole, setNewRole] = useState('USER')
    const [creating, setCreating] = useState(false)
    const [editingUserId, setEditingUserId] = useState(null)
    const [editEmail, setEditEmail] = useState('')
    const [editName, setEditName] = useState('')
    const [savingEdit, setSavingEdit] = useState(false)
    const [deletingUserId, setDeletingUserId] = useState(null)

    const load = async () => {
        const attempts = [
            () => api.get('/api/admin/users'),
            () => api.get('/api/admin/users-staff'),
            () => api.get('/api/users'),
        ]
        let loaded = false
        for (const attempt of attempts) {
            try {
                const { data } = await attempt()
                if (Array.isArray(data)) {
                    setUsers(data)
                    loaded = true
                    break
                }
            } catch {
                // try next endpoint
            }
        }
        if (!loaded) setErr('Failed to load users')
    }

    useEffect(() => {
        if (user?.role === 'ADMIN') void load()
    }, [user])

    if (authLoading) {
        return (
            <div className="card" style={{ maxWidth: 480 }}>
                <p className="small">Checking your session…</p>
            </div>
        )
    }
    if (!user) return <Navigate to="/login" replace />
    if (user.role !== 'ADMIN') return <Navigate to="/" replace />

    const changeRole = async (id, newRole) => {
        setErr(null)
        try {
            await api.put(`/api/admin/users/${id}/role`, { role: newRole })
            await load()
        } catch {
            setErr('Failed to update user role')
        }
    }

    const addUser = async (e) => {
        e.preventDefault()
        setErr(null)
        const email = newEmail.trim()
        const name = newName.trim()
        const password = newPassword
        if (!email || !name || !password) {
            setErr('Email, display name, and password are required.')
            return
        }

        setCreating(true)
        const attempts = [
            () => api.post('/api/admin/users', { email, displayName: name, password, role: newRole }),
            () => api.post('/api/admin/users', { email, name, password, role: newRole }),
            () => api.post('/api/auth/register', { email, displayName: name, password, role: newRole }),
            () => api.post('/api/auth/signup', { email, displayName: name, password, role: newRole }),
        ]
        let ok = false
        for (const attempt of attempts) {
            try {
                await fetchCsrf()
                await attempt()
                ok = true
                break
            } catch {
                // try next endpoint
            }
        }
        if (!ok) {
            setErr('Failed to create user with password')
            setCreating(false)
            return
        }
        setNewEmail('')
        setNewName('')
        setNewPassword('')
        setNewRole('USER')
        await load()
        setCreating(false)
    }

    const filteredUsers = users.filter((u) => {
        if (filter && u.role !== filter) return false
        const q = search.trim().toLowerCase()
        if (!q) return true
        const email = (u.email ?? '').toLowerCase()
        const name = (u.displayName ?? '').toLowerCase()
        const role = (u.role ?? '').toLowerCase()
        return email.includes(q) || name.includes(q) || role.includes(q)
    })

    const startEdit = (u) => {
        setErr(null)
        setEditingUserId(u.id)
        setEditEmail(u.email ?? '')
        setEditName(u.displayName ?? '')
    }

    const cancelEdit = () => {
        setEditingUserId(null)
        setEditEmail('')
        setEditName('')
    }

    const saveEdit = async () => {
        if (!editingUserId) return
        setErr(null)
        const payload = {
            email: editEmail.trim(),
            displayName: editName.trim(),
        }
        if (!payload.email || !payload.displayName) {
            setErr('Email and display name are required.')
            return
        }
        setSavingEdit(true)
        const attempts = [
            () => api.put(`/api/admin/users/${editingUserId}`, payload),
            () => api.patch(`/api/admin/users/${editingUserId}`, payload),
            () => api.put(`/api/users/${editingUserId}`, payload),
            () => api.patch(`/api/users/${editingUserId}`, payload),
        ]
        let ok = false
        for (const attempt of attempts) {
            try {
                await attempt()
                ok = true
                break
            } catch {
                // try next endpoint
            }
        }
        if (!ok) {
            setErr('Failed to update user')
            setSavingEdit(false)
            return
        }
        await load()
        setSavingEdit(false)
        cancelEdit()
    }

    const deleteUser = async (id) => {
        if (!window.confirm('Delete this user?')) return
        setErr(null)
        setDeletingUserId(id)
        const attempts = [
            () => api.delete(`/api/admin/users/${id}`),
            () => api.delete(`/api/users/${id}`),
            () => api.post(`/api/admin/users/${id}/delete`),
            () => api.post('/api/admin/users/delete', { id }),
        ]
        let ok = false
        let lastError = null
        for (const attempt of attempts) {
            try {
                await attempt()
                ok = true
                break
            } catch (error) {
                lastError = error
                // try next endpoint
            }
        }
        if (!ok) {
            const status = lastError?.response?.status
            const message = lastError?.response?.data?.message
            if (status === 403) {
                setErr('Delete failed: forbidden (your account may not have permission).')
            } else if (status === 404) {
                setErr('Delete failed: user endpoint not found on backend.')
            } else if (message) {
                setErr(`Delete failed: ${message}`)
            } else {
                setErr('Failed to delete user')
            }
            setDeletingUserId(null)
            return
        }
        await load()
        if (editingUserId === id) {
            cancelEdit()
        }
        setDeletingUserId(null)
    }

    return (
        <div>
            <section className="hero-card rainbow mb-6">
                <div className="hero-grid">
                    <div className="relative z-10">
                        <p className="glass-chip">User Management</p>
                        <h1 className="mt-3 flex items-center gap-2">
                            <HiOutlineUsers className="text-cyan-300" />
                            <span className="gradient-title">Administer Platform Users</span>
                        </h1>
                        <p className="small max-w-2xl">
                            Control access levels, upgrade permissions, and manage all users across the Smart Campus Hub.
                        </p>
                    </div>
                    <img
                        src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1100&q=80"
                        alt="Business team discussing"
                        className="feature-image"
                    />
                </div>
            </section>

            <h1 className="flex items-center gap-2">
                <HiOutlineUsers className="text-cyan-300" />
                Admin — User Roster
            </h1>
            <div className="card-grid">
                <div className="card">
                    <p className="small flex items-center gap-2"><HiOutlineUserGroup className="text-amber-300" /> Users</p>
                    <p className="text-3xl font-bold metric-value">{users.filter((x) => x.role === 'USER').length}</p>
                </div>
                <div className="card">
                    <p className="small flex items-center gap-2"><HiOutlineShieldCheck className="text-emerald-300" /> Technicians</p>
                    <p className="text-3xl font-bold metric-value">{users.filter((x) => x.role === 'TECHNICIAN').length}</p>
                </div>
                <div className="card">
                    <p className="small flex items-center gap-2"><HiOutlineShieldCheck className="text-emerald-300" /> Administrators</p>
                    <p className="text-3xl font-bold metric-value">{users.filter((x) => x.role === 'ADMIN').length}</p>
                </div>
            </div>

            <div className="mb-4 flex flex-wrap items-end gap-4">
                <div className="field" style={{ flex: '1 1 220px', maxWidth: 400 }}>
                    <label htmlFor="admin-users-search">Search</label>
                    <input
                        id="admin-users-search"
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Email, display name, or role"
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
                <div className="field" style={{ flex: '0 1 220px', maxWidth: 300 }}>
                    <label htmlFor="admin-users-role-filter">Filter by role</label>
                    <select
                        id="admin-users-role-filter"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        <option value="">All roles</option>
                        <option value="USER">USER</option>
                        <option value="TECHNICIAN">TECHNICIAN</option>
                        <option value="ADMIN">ADMIN</option>
                    </select>
                </div>
            </div>
            {search.trim() && (
                <p className="small mb-4">
                    Showing {filteredUsers.length} of {users.length} users
                </p>
            )}

            <div className="card">
                <h2 className="flex items-center gap-2" style={{ color: 'var(--sc-navy-900)' }}>
                    <HiOutlineUserPlus className="text-cyan-300" aria-hidden />
                    Add user manually
                </h2>
                <form onSubmit={(e) => void addUser(e)}>
                    <div className="field">
                        <label>Email</label>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            required
                            placeholder="user@campus.local"
                        />
                    </div>
                    <div className="field">
                        <label>Display name</label>
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                            placeholder="User full name"
                        />
                    </div>
                    <div className="field">
                        <label>Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="Minimum 6 characters"
                        />
                    </div>
                    <div className="field" style={{ maxWidth: 300 }}>
                        <label>Role</label>
                        <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                            <option value="USER">USER</option>
                            <option value="TECHNICIAN">TECHNICIAN</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>
                    </div>
                    <button type="submit" className="btn primary" disabled={creating}>
                        {creating ? 'Creating…' : 'Add user'}
                    </button>
                </form>
            </div>

            {err && <p className="error">{err}</p>}

            <div className="card-grid">
                {filteredUsers.map((u) => (
                    <div key={u.id} className="card stack">
                        <div className="flex items-center justify-between">
                            <h2 style={{ color: 'var(--sc-navy-900)' }}>
                                {editingUserId === u.id ? editName : u.displayName}
                            </h2>
                            <span className="tag" style={{ opacity: 0.8 }}>{u.role}</span>
                        </div>
                        {editingUserId === u.id ? (
                            <>
                                <div className="field">
                                    <label>Display name</label>
                                    <input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="field">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={editEmail}
                                        onChange={(e) => setEditEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </>
                        ) : (
                            <p className="small">{u.email}</p>
                        )}
                        <div className="field mt-3">
                            <label>Update Role</label>
                            <div className="row-actions">
                                <select
                                    value={u.role}
                                    onChange={(e) => void changeRole(u.id, e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    <option value="USER">USER</option>
                                    <option value="TECHNICIAN">TECHNICIAN</option>
                                    <option value="ADMIN">ADMIN</option>
                                </select>
                                {editingUserId === u.id ? (
                                    <>
                                        <button
                                            type="button"
                                            className="btn primary"
                                            onClick={() => void saveEdit()}
                                            disabled={savingEdit}
                                        >
                                            {savingEdit ? 'Saving…' : 'Save'}
                                        </button>
                                        <button type="button" className="btn ghost" onClick={cancelEdit}>
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button type="button" className="btn ghost" onClick={() => startEdit(u)}>
                                        Edit
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn danger"
                                    onClick={() => void deleteUser(u.id)}
                                    disabled={deletingUserId === u.id}
                                >
                                    {deletingUserId === u.id ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
