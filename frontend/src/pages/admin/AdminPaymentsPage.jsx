import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, Download, Filter, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertTriangle
} from 'lucide-react';
import { Card, CardBody, Button, Select } from '../../components/ui';
import api from '../../services/api';
import { exportToCSV } from '../../utils/export';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchPayments();
    fetchSummary();
  }, [pagination.page, statusFilter]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (statusFilter) params.status = statusFilter;
      
      const response = await api.get('/admin/payments', { params });
      setPayments(response.data.data);
      setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get('/admin/payments/summary');
      setSummary(response.data.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      authorized: 'bg-blue-100 text-blue-700',
      captured: 'bg-green-100 text-green-700',
      refunded: 'bg-red-100 text-red-700',
      partially_refunded: 'bg-orange-100 text-orange-700',
      voided: 'bg-gray-100 text-gray-700',
      failed: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const handleExport = () => {
    exportToCSV(payments, 'payments_report', {
      'Date': 'createdAt',
      'Driver': 'driverName',
      'Host': 'hostName',
      'Charger': 'chargerName',
            'Amount ($)': 'amount',
      'Platform Fee ($)': 'platformFee',
      'Status': 'status',
      'PayPal ID': 'paypalOrderId',
    });
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
              <span>Payments</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Payments & Invoices</h1>
          </div>
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardBody>
                <p className="text-sm text-gray-500">Gross Revenue</p>
                                <p className="text-2xl font-bold text-gray-900">${summary.grossRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">{summary.transactions} transactions</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-gray-500">Platform Fees (7%)</p>
                                <p className="text-2xl font-bold text-green-600">${summary.platformFees.toLocaleString()}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-gray-500">Host Payouts</p>
                                <p className="text-2xl font-bold text-blue-600">${summary.hostPayouts.toLocaleString()}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-gray-500">Refunds</p>
                                <p className="text-2xl font-bold text-red-600">${summary.refunds.amount.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">{summary.refunds.count} refunds</p>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-400" />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All Statuses"
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'authorized', label: 'Authorized' },
                  { value: 'captured', label: 'Captured' },
                  { value: 'refunded', label: 'Refunded' },
                  { value: 'failed', label: 'Failed' },
                ]}
                className="w-48"
              />
            </div>
          </CardBody>
        </Card>

        {/* Payments Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Host</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charger</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Platform Fee</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PayPal ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  payments.map(payment => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{payment.driver}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{payment.host}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{payment.charger}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                                                ${(payment.capturedAmount || payment.authorizedAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-green-600 text-right">
                        {payment.platformFee ? `$${payment.platformFee.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 font-mono">
                        {payment.paypalOrderId ? payment.paypalOrderId.slice(0, 12) + '...' : '-'}
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
              {pagination.total} payments
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= totalPages}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </Card>

        {/* Legal Notice */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> All payment data is sourced from PayPal and is subject to their 
            processing times. Detailed transaction records are available in your PayPal Business Dashboard.
            Platform fees are calculated at 7% of the transaction amount.
          </p>
        </div>
      </div>
    </div>
  );
}
