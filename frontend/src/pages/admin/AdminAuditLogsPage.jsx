import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, Filter, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  Download, Search, Eye
} from 'lucide-react';
import { Card, CardBody, Button, Select } from '../../components/ui';
import api from '../../services/api';
import { exportToCSV } from '../../utils/export';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [filters, setFilters] = useState({
    action: '',
    startDate: '',
    endDate: '',
  });
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (filters.action) params.action = filters.action;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get('/admin/audit-logs', { params });
      setLogs(response.data.data);
      setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogDetails = async (id) => {
    try {
      const response = await api.get(`/admin/audit-logs/${id}`);
      setSelectedLog(response.data.data);
    } catch (err) {
      console.error('Failed to fetch log details:', err);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const handleExport = () => {
    exportToCSV(logs, 'audit_logs', {
      'Timestamp': 'createdAt',
      'Action': 'action',
      'User/Agent': 'user.name',
      'Success': 'success',
      'Duration (ms)': 'durationMs',
    });
  };

  const actionTypes = [
    'USER_VERIFIED',
    'USER_UNVERIFIED',
    'CHARGER_STATUS_UPDATED',
    'CONFIG_UPDATED',
    'USER_DATA_EXPORTED',
    'BOOKING_CREATED',
    'BOOKING_CANCELLED',
    'PAYMENT_CAPTURED',
    'DISPUTE_RESOLVED',
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link to="/admin/dashboard" className="hover:text-primary-600">Admin</Link>
              <span>/</span>
              <span>Audit Logs</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-gray-600 mt-1">Complete audit trail for compliance and accountability</p>
          </div>
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export Logs
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex flex-wrap gap-6 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                <Select
                  value={filters.action}
                  onChange={(value) => setFilters(prev => ({ ...prev, action: value }))}
                  options={[
                    { value: '', label: 'All Actions' },
                    ...actionTypes.map(action => ({
                      value: action,
                      label: action.replace(/_/g, ' ')
                    }))
                  ]}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setFilters({ action: '', startDate: '', endDate: '' })}
              >
                Clear Filters
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logs Table */}
          <div className="lg:col-span-2">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User/Agent</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                          No audit logs found
                        </td>
                      </tr>
                    ) : (
                      logs.map(log => (
                        <tr
                          key={log.id}
                          onClick={() => fetchLogDetails(log.id)}
                          className={`cursor-pointer hover:bg-gray-50 ${
                            selectedLog?.id === log.id ? 'bg-primary-50' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900">
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {log.user?.name || log.agent?.name || 'System'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {log.success ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 text-right">
                            {log.durationMs ? `${log.durationMs}ms` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {pagination.total} total logs
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-600">
                    Page {pagination.page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= totalPages}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* Log Details */}
          <Card>
            <CardBody>
              {selectedLog ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Details</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Action</label>
                      <p className="font-medium text-gray-900">{selectedLog.action.replace(/_/g, ' ')}</p>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 uppercase">Timestamp</label>
                      <p className="text-gray-900">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 uppercase">Performed By</label>
                      <p className="text-gray-900">
                        {selectedLog.user?.name || selectedLog.agent?.name || 'System'}
                        {selectedLog.user?.email && (
                          <span className="text-gray-500 text-sm ml-1">({selectedLog.user.email})</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 uppercase">Status</label>
                      <p className={selectedLog.success ? 'text-green-600' : 'text-red-600'}>
                        {selectedLog.success ? 'Success' : 'Failed'}
                      </p>
                    </div>

                    {selectedLog.errorMessage && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Error</label>
                        <p className="text-red-600 text-sm">{selectedLog.errorMessage}</p>
                      </div>
                    )}

                    {selectedLog.durationMs && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Duration</label>
                        <p className="text-gray-900">{selectedLog.durationMs}ms</p>
                      </div>
                    )}

                    {selectedLog.inputs && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Input Data</label>
                        <pre className="mt-1 p-3 bg-gray-100 rounded-lg text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.inputs, null, 2)}
                        </pre>
                      </div>
                    )}

                    {selectedLog.outputs && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Output Data</label>
                        <pre className="mt-1 p-3 bg-gray-100 rounded-lg text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.outputs, null, 2)}
                        </pre>
                      </div>
                    )}

                    {selectedLog.booking && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Related Booking</label>
                        <p className="text-gray-900">
                          {selectedLog.booking.id} ({selectedLog.booking.status})
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a log entry to view details</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Legal Notice */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Compliance Notice:</strong> Audit logs are retained for 7 years in accordance with 
            financial record-keeping regulations. Sensitive data is automatically redacted from log entries.
            Logs cannot be modified or deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
