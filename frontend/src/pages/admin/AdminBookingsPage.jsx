import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Filter, ChevronLeft, ChevronRight, Eye,
  Clock, MapPin, User, Zap, CreditCard
} from 'lucide-react';
import { Card, CardBody, Button, Select } from '../../components/ui';
import api from '../../services/api';

const STATUS_CONFIG = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  authorized: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Authorized' },
  in_progress: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Progress' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
  no_show: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'No Show' },
  disputed: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Disputed' },
};

const PAYMENT_STATUS_CONFIG = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  authorized: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Authorized' },
  captured: { bg: 'bg-green-100', text: 'text-green-700', label: 'Captured' },
  refunded: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Refunded' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, [pagination.page, statusFilter]);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (statusFilter) params.status = statusFilter;

      const response = await api.get('/admin/bookings', { params });
      setBookings(response.data.data || []);
      setPagination(prev => ({ 
        ...prev, 
        total: response.data.pagination?.total || 0 
      }));
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setError(err.response?.data?.error?.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

    const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status) => {
    if (!status) return <span className="text-gray-400 text-xs">N/A</span>;
    const config = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/admin/dashboard" className="hover:text-primary-600">Admin</Link>
            <span>/</span>
            <span>Bookings</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Booking Management</h1>
          <p className="text-gray-600 mt-1">View and manage all platform bookings</p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {Object.entries(STATUS_CONFIG).slice(0, 5).map(([key, config]) => (
            <Card key={key} className="cursor-pointer hover:border-primary-300" onClick={() => setStatusFilter(key)}>
              <CardBody className="p-4">
                <p className="text-2xl font-bold text-gray-900">
                  {bookings.filter(b => b.status === key).length || 0}
                </p>
                <p className={`text-sm ${config.text}`}>{config.label}</p>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-400" />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: '', label: 'All Statuses' },
                  ...Object.entries(STATUS_CONFIG).map(([value, config]) => ({
                    value,
                    label: config.label
                  }))
                ]}
                className="w-48"
              />
              {statusFilter && (
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter('')}>
                  Clear Filter
                </Button>
              )}
              <div className="ml-auto text-sm text-gray-500">
                {pagination.total} total bookings
              </div>
            </div>
          </CardBody>
        </Card>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bookings Table */}
          <div className="lg:col-span-2">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charger</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                        </td>
                      </tr>
                    ) : bookings.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          No bookings found
                        </td>
                      </tr>
                    ) : (
                      bookings.map(booking => (
                        <tr
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedBooking?.id === booking.id ? 'bg-primary-50' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {formatDate(booking.scheduledStart)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900">
                              {booking.chargerName || 'Unknown Charger'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {booking.driverName || 'Unknown Driver'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getStatusBadge(booking.status)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                                                        ${(booking.totalAmount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getPaymentStatusBadge(booking.paymentStatus)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {pagination.page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= totalPages}
                      className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Booking Details Sidebar */}
          <Card>
            <CardBody>
              {selectedBooking ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Details</h3>
                  
                  <div className="space-y-4">
                    {/* Booking ID */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Booking ID</label>
                      <p className="font-mono text-sm text-gray-900 break-all">{selectedBooking.id}</p>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Status</label>
                      <div className="mt-1">{getStatusBadge(selectedBooking.status)}</div>
                    </div>

                    {/* Charger */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Charger
                      </label>
                      <p className="text-gray-900 font-medium">{selectedBooking.chargerName || 'Unknown'}</p>
                    </div>

                    {/* Driver */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                        <User className="w-3 h-3" /> Driver
                      </label>
                      <p className="text-gray-900">{selectedBooking.driverName || 'Unknown'}</p>
                    </div>

                    {/* Scheduled Time */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Scheduled Time
                      </label>
                      <p className="text-gray-900">{formatDate(selectedBooking.scheduledStart)}</p>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> Amount
                      </label>
                      <p className="text-2xl font-bold text-gray-900">
                                                ${(selectedBooking.totalAmount || 0).toLocaleString()}
                      </p>
                    </div>

                    {/* Payment Status */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Payment Status</label>
                      <div className="mt-1">{getPaymentStatusBadge(selectedBooking.paymentStatus)}</div>
                    </div>

                    {/* Created At */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Created</label>
                      <p className="text-gray-600 text-sm">{formatDate(selectedBooking.createdAt)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <Link
                      to={`/bookings/${selectedBooking.id}`}
                      className="block w-full text-center py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      View Full Details
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a booking to view details</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
