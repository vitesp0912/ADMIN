import { useState, useEffect } from 'react'
// Simple responsive modal component
function Modal({ open, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 px-2">
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-md relative mx-auto" style={{maxWidth: 400}}>
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  )
}
import { supabase } from '../lib/supabase'
import { Search, User, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'

// Helper function to convert text to Title Case
const toTitleCase = (str) => {
  if (!str) return str
  return str
    .toString()
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [pumps, setPumps] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  // Password modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalUser, setModalUser] = useState(null)
  const [modalPassword, setModalPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [closeTimeout, setCloseTimeout] = useState(null)

  const openPasswordModal = (user) => {
    setModalUser(user)
    setModalPassword('')
    setPasswordError('')
    setPasswordSuccess('')
    setShowPassword(false)
    setModalOpen(true)
  }
  const closePasswordModal = () => {
    setModalOpen(false)
    setModalUser(null)
    setModalPassword('')
    setPasswordError('')
    setPasswordSuccess('')
    setShowPassword(false)
    if (closeTimeout) {
      clearTimeout(closeTimeout)
      setCloseTimeout(null)
    }
  }

  const handleSetPassword = async () => {
    if (!modalPassword || modalPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }
    setPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')
    try {
      const { error } = await supabase.rpc('set_user_password', {
        p_user_id: modalUser.id,
        p_new_password: modalPassword
      })
      if (error) {
        setPasswordError(error.message || 'Failed to set password.')
      } else {
        setPasswordSuccess('Password set successfully!')
        setModalPassword('')
        // Auto-close modal after short delay
        const timeout = setTimeout(() => {
          closePasswordModal()
        }, 1200)
        setCloseTimeout(timeout)
      }
    } catch (err) {
      setPasswordError(err.message || 'Failed to set password.')
    } finally {
      setPasswordLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [filterRole])

  const fetchUsers = async () => {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterRole !== 'all') {
        query = query.eq('role', filterRole)
      }

      const { data, error } = await query

      if (error) throw error

      setUsers(data || [])

      // Fetch pump names for each user
      const pumpIds = [...new Set((data || []).map((u) => u.pump_id))]
      const { data: pumpsData, error: pumpsError } = await supabase
        .from('pumps')
        .select('id, name, pump_code')
        .in('id', pumpIds)

      if (!pumpsError && pumpsData) {
        const pumpsMap = {}
        pumpsData.forEach((pump) => {
          pumpsMap[pump.id] = pump
        })
        setPumps(pumpsMap)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm) ||
      pumps[user.pump_id]?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pumps[user.pump_id]?.pump_code?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading users...</p>
        </div>
      </div>
    )
  }

  const roles = ['dealer', 'manager', 'fsm']

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <User className="w-8 h-8 text-purple-600" />
            Users
          </h1>
          <p className="text-gray-600">Manage all system users</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
          >
            <option value="all">All Roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pump
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-purple-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{user.name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pumps[user.pump_id] ? (
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {pumps[user.pump_id].name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {pumps[user.pump_id].pump_code}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {user.role ? toTitleCase(user.role) : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.is_active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/pumps/${user.pump_id}`}
                        className="text-purple-600 hover:text-purple-800 flex items-center gap-1 font-semibold hover:underline transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Pump
                      </Link>
                      <button
                        className="ml-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded px-3 py-1 text-xs font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                        onClick={() => openPasswordModal(user)}
                      >
                        Set Password
                      </button>
                    </td>
                        {/* Password Modal */}
                        <Modal open={modalOpen} onClose={closePasswordModal}>
                          <h2 className="text-lg font-bold mb-2 text-gray-900">Set Password for {modalUser?.name || modalUser?.phone}</h2>
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                            <div className="relative flex items-center">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                className="border border-gray-300 rounded-lg px-3 py-2 w-full pr-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base"
                                placeholder="Enter new password"
                                value={modalPassword}
                                onChange={e => setModalPassword(e.target.value)}
                                disabled={passwordLoading}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="absolute right-2 text-gray-400 hover:text-gray-700"
                                onClick={() => setShowPassword(v => !v)}
                                tabIndex={-1}
                              >
                                {showPassword ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.042-3.368m3.087-2.933A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.956 9.956 0 01-4.043 5.293M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 6l-6-6" /></svg>
                                )}
                              </button>
                            </div>
                          </div>
                          {passwordError && <div className="text-sm text-red-600 mb-2">{passwordError}</div>}
                          {passwordSuccess && <div className="text-sm text-green-600 mb-2">{passwordSuccess}</div>}
                          <div className="flex gap-2 mt-4">
                            <button
                              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded px-4 py-2 font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60"
                              onClick={handleSetPassword}
                              disabled={passwordLoading}
                            >
                              {passwordLoading ? 'Setting...' : 'Set Password'}
                            </button>
                            <button
                              className="bg-gray-200 text-gray-700 rounded px-4 py-2 font-semibold hover:bg-gray-300 transition-all duration-200"
                              onClick={closePasswordModal}
                              disabled={passwordLoading}
                            >
                              Cancel
                            </button>
                          </div>
                        </Modal>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-md border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700">
          Showing <span className="font-bold text-gray-900">{filteredUsers.length}</span> of <span className="font-bold text-gray-900">{users.length}</span> users
        </p>
      </div>
    </div>
  )
}

