import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Select } from '../../components/ui';
import api from '../../services/api';

export default function AdminChargersPage() {
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({ status: '', city: '' });
  const [selectedCharger, setSelectedCharger] = useState(null);
  const [chargerDetails, setChargerDetails] = useState(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchChargers();
  }, [pagination.page, filters]);

  const fetchChargers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
      });
      if (filters.status) params.append('status', filters.status);
      if (filters.city) params.append('city', filters.city);

      const response = await api.get(`/admin/chargers?${params}`);
      setChargers(response.data.data);
      setPagination(prev => ({ ...prev, ...response.data.pagination }));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load chargers');
    } finally {
      setLoading(false);
    }
  };

  const fetchChargerDetails = async (id) => {
    try {
      setActionLoading(true);
      const response = await api.get(`/admin/chargers/${id}`);
      setChargerDetails(response.data.data.charger);
      setSelectedCharger(id);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load charger details');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockCharger = async () => {
    if (!blockReason.trim() || blockReason.length < 5) {
      alert('Please provide a reason for blocking (at least 5 characters)');
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/admin/chargers/${selectedCharger}/block`, { reason: blockReason });
      setShowBlockModal(false);
      setBlockReason('');
      fetchChargers();
      if (chargerDetails) {
        fetchChargerDetails(selectedCharger);
      }
      alert('Charger blocked successfully');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to block charger');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockCharger = async (id) => {
    if (!confirm('Are you sure you want to unblock this charger?')) return;

    try {
      setActionLoading(true);
      await api.post(`/admin/chargers/${id}/unblock`);
      fetchChargers();
      if (chargerDetails && selectedCharger === id) {
        fetchChargerDetails(id);
      }
      alert('Charger unblocked successfully');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to unblock charger');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      setActionLoading(true);
      await api.patch(`/admin/chargers/${id}/status`, { status: newStatus });
      fetchChargers();
      if (chargerDetails && selectedCharger === id) {
        fetchChargerDetails(id);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeClass = (status, isBlocked) => {
    if (isBlocked) return 'bg-red-100 text-red-800';
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && chargers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manage Chargers</h1>
          <p className="mt-2 text-gray-600">View, monitor, and manage all charger listings</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Select
                value={filters.status}
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'maintenance', label: 'Maintenance' },
                  { value: 'blocked', label: 'Blocked' },
                ]}
                className="w-44"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={filters.city}
                onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Filter by city..."
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ status: '', city: '' })}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chargers List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  All Chargers ({pagination.total})
                </h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {chargers.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No chargers found
                  </div>
                ) : (
                  chargers.map((charger) => (
                    <div
                      key={charger.id}
                      className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedCharger === charger.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                      }`}
                      onClick={() => fetchChargerDetails(charger.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">{charger.name}</h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeClass(charger.status, charger.isBlocked)}`}>
                              {charger.isBlocked ? 'BLOCKED' : charger.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{charger.address}</p>
                          <p className="text-sm text-gray-400">{charger.city}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-gray-600">
                              <span className="font-medium">{charger.connectorType}</span> • {charger.kwTier}
                            </span>
                            <span className="text-gray-600">
                              Host: <span className="font-medium">{charger.host?.name}</span>
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            {charger.bookings} bookings
                          </div>
                          {charger.rating && (
                            <div className="flex items-center justify-end gap-1 text-sm text-yellow-600">
                              <span>★</span>
                              <span>{charger.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Charger Details Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm sticky top-4">
              {!chargerDetails ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="mt-2">Select a charger to view details</p>
                </div>
              ) : actionLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                </div>
              ) : (
                <div className="p-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">{chargerDetails.name}</h2>
                  
                  {/* Status & Actions */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusBadgeClass(chargerDetails.status, chargerDetails.isBlocked)}`}>
                        {chargerDetails.isBlocked ? 'BLOCKED' : chargerDetails.status.toUpperCase()}
                      </span>
                      {chargerDetails.isBlocked ? (
                        <button
                          onClick={() => handleUnblockCharger(chargerDetails.id)}
                          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                        >
                          Unblock
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowBlockModal(true)}
                          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
                        >
                          Block Charger
                        </button>
                      )}
                    </div>

                    {/* Block Info */}
                    {chargerDetails.isBlocked && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-red-800">Blocked</p>
                        <p className="text-sm text-red-600 mt-1">{chargerDetails.blockReason}</p>
                        {chargerDetails.blockedBy && (
                          <p className="text-xs text-red-500 mt-1">
                            By: {chargerDetails.blockedBy.name} on {new Date(chargerDetails.blockedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Status Change (only if not blocked) */}
                    {!chargerDetails.isBlocked && (
                      <div className="flex gap-2">
                        <Select
                          value={chargerDetails.status}
                          onChange={(value) => handleStatusChange(chargerDetails.id, value)}
                          options={[
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' },
                            { value: 'maintenance', label: 'Maintenance' },
                          ]}
                          className="flex-1"
                        />
                      </div>
                    )}
                  </div>

                  {/* Location */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Location</h3>
                    <p className="text-sm text-gray-600">{chargerDetails.address}</p>
                    <p className="text-sm text-gray-500">{chargerDetails.city}</p>
                  </div>

                  {/* Specs */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Specifications</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 rounded p-2">
                        <span className="text-gray-500">Connector</span>
                        <p className="font-medium">{chargerDetails.connectorType}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <span className="text-gray-500">Power</span>
                        <p className="font-medium">{chargerDetails.kwTier}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Statistics</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-green-50 rounded p-2">
                        <span className="text-gray-500">Total Bookings</span>
                        <p className="font-bold text-green-700">{chargerDetails.totalBookings}</p>
                      </div>
                      <div className="bg-yellow-50 rounded p-2">
                        <span className="text-gray-500">Rating</span>
                        <p className="font-bold text-yellow-700">
                          {chargerDetails.avgRating ? `${chargerDetails.avgRating.toFixed(1)} ★` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Revenue */}
                  {chargerDetails.revenue && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Revenue</h3>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Total Revenue</span>
                          <span className="font-bold text-blue-700">₹{chargerDetails.revenue.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Platform Fees</span>
                          <span className="font-medium text-gray-700">₹{chargerDetails.revenue.platformFees.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Host Payouts</span>
                          <span className="font-medium text-gray-700">₹{chargerDetails.revenue.hostPayouts.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Host Info */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Host</h3>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="font-medium text-gray-900">{chargerDetails.host?.name}</p>
                      <p className="text-sm text-gray-500">{chargerDetails.host?.email}</p>
                      {chargerDetails.host?.phone && (
                        <p className="text-sm text-gray-500">{chargerDetails.host?.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Recent Bookings */}
                  {chargerDetails.recentBookings?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Bookings</h3>
                      <div className="space-y-2">
                        {chargerDetails.recentBookings.slice(0, 5).map((booking) => (
                          <div key={booking.id} className="bg-gray-50 rounded p-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">{booking.driver}</span>
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                                booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                            <p className="text-gray-500 text-xs">
                              {new Date(booking.scheduledStart).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Ratings */}
                  {chargerDetails.recentRatings?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Reviews</h3>
                      <div className="space-y-2">
                        {chargerDetails.recentRatings.slice(0, 3).map((rating, idx) => (
                          <div key={idx} className="bg-gray-50 rounded p-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-yellow-500">{'★'.repeat(rating.rating)}</span>
                              <span className="text-gray-400">{'★'.repeat(5 - rating.rating)}</span>
                            </div>
                            {rating.review && <p className="text-gray-600 text-xs mt-1">{rating.review}</p>}
                            <p className="text-gray-400 text-xs mt-1">- {rating.driver}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Block Modal */}
        {showBlockModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Block Charger</h3>
              <p className="text-sm text-gray-600 mb-4">
                Blocking this charger will remove it from public listings. The host will not be able to receive new bookings.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for blocking *
                </label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="e.g., Low rating, multiple complaints, safety concerns..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowBlockModal(false);
                    setBlockReason('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlockCharger}
                  disabled={actionLoading || blockReason.length < 5}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Blocking...' : 'Block Charger'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
