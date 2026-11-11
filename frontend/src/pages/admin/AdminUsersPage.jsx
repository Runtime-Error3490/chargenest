import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Users, Search, Filter, ChevronLeft, ChevronRight,
  Eye, Shield, CheckCircle, XCircle, Download
} from 'lucide-react';
import { Card, CardBody, Button, Input, Select } from '../../components/ui';
import api from '../../services/api';
import { exportToCSV } from '../../utils/export';

const fmtUSD = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function UserDetail({ id }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/users/${id}`);
      setUser(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const toggleVerify = async () => {
    setActing(true);
    try {
      await api.post(`/admin/users/${id}/action`, { action: user.isVerified ? 'unverify' : 'verify' });
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const Stat = ({ label, value }) => (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="text-xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/admin/users" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Users
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : !user ? (
          <Card><CardBody><p className="text-center text-red-600">{error || 'User not found'}</p></CardBody></Card>
        ) : (
          <div className="space-y-8">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Card>
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                    <p className="text-gray-600">{user.email}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Phone: {user.phone || '—'} · Joined {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {user.roles.map(r => (
                        <span key={r} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full capitalize">{r}</span>
                      ))}
                      <span className={`px-2 py-1 text-xs rounded-full ${user.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {user.isVerified ? 'Verified' : 'Unverified'}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        MFA {user.totpEnabled ? 'on' : 'off'}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={toggleVerify} disabled={acting}>
                    {user.isVerified ? 'Unverify' : 'Verify'}
                  </Button>
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Stat label="Bookings" value={user.stats.totalBookings} />
              <Stat label="Chargers" value={user.stats.totalChargers} />
              <Stat label="Disputes" value={user.stats.totalDisputes} />
                            <Stat label="Spent" value={fmtUSD(user.stats.totalSpent)} />
              <Stat label="Earned" value={fmtUSD(user.stats.totalEarned)} />
            </div>

            <Card>
              <CardBody>
                <h3 className="font-semibold text-gray-900 mb-4">Recent Bookings</h3>
                {user.recentBookings.length === 0 ? (
                  <p className="text-sm text-gray-500">No bookings</p>
                ) : (
                  <div className="divide-y">
                    {user.recentBookings.map(b => (
                      <div key={b.id} className="py-3 flex justify-between text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{b.charger}</p>
                          <p className="text-gray-500">{b.date ? new Date(b.date).toLocaleString() : '—'}</p>
                        </div>
                        <div className="text-right">
                                                    <p className="font-medium">{fmtUSD(b.amount)}</p>
                          <p className="text-gray-500 capitalize">{String(b.status).replace('_', ' ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {user.chargers.length > 0 && (
              <Card>
                <CardBody>
                  <h3 className="font-semibold text-gray-900 mb-4">Chargers</h3>
                  <div className="divide-y">
                    {user.chargers.map(c => (
                      <div key={c.id} className="py-3 flex justify-between text-sm">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-gray-500 capitalize">
                          {c.status} · {c.bookings} bookings{c.rating ? ` · ★ ${c.rating.toFixed(1)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {user.disputes.length > 0 && (
              <Card>
                <CardBody>
                  <h3 className="font-semibold text-gray-900 mb-4">Disputes</h3>
                  <div className="divide-y">
                    {user.disputes.map(d => (
                      <div key={d.id} className="py-3 flex justify-between text-sm">
                        <p className="text-gray-900 capitalize">{String(d.reason).replace(/_/g, ' ')}</p>
                        <p className="text-gray-500 capitalize">{String(d.status).replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { id } = useParams();
  return id ? <UserDetail id={id} /> : <UserList />;
}

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, [pagination.page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users', {
        params: { page: pagination.page, limit: pagination.limit },
      });
      setUsers(response.data.data);
      setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
                          user.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const handleExport = () => {
    exportToCSV(filteredUsers, 'users', {
      'Name': 'name',
      'Email': 'email',
      'Roles': 'roles',
      'Bookings': 'bookings',
      'Chargers': 'chargers',
      'Joined': 'createdAt',
    });
  };

  const getRoleBadge = (roles) => {
    if (roles.includes('admin')) {
      return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Admin</span>;
    }
    if (roles.includes('driver') && roles.includes('host')) {
      return <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full">Client + Host</span>;
    }
    if (roles.includes('driver')) {
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Client</span>;
    }
    if (roles.includes('host')) {
      return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Host</span>;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link to="/admin/dashboard" className="hover:text-primary-600">Admin</Link>
              <span>/</span>
              <span>Users</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          </div>
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={[
                    { value: 'all', label: 'All Roles' },
                    { value: 'driver', label: 'Clients' },
                    { value: 'host', label: 'Hosts' },
                    { value: 'admin', label: 'Admins' },
                  ]}
                  className="w-40"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Users Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chargers</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getRoleBadge(user.roles)}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{user.bookings}</td>
                      <td className="px-6 py-4 text-gray-700">{user.chargers}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/admin/users/${user.id}`}
                          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} users
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= totalPages}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
