import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle, XCircle, Clock, Eye,
  ChevronLeft, ChevronRight, MessageSquare
} from 'lucide-react';
import { Card, CardBody, Button, Select } from '../../components/ui';
import api from '../../services/api';

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [resolution, setResolution] = useState({
    decision: 'release_to_host',
    refundAmount: 0,
    adminNotes: '',
  });

  useEffect(() => {
    fetchDisputes();
  }, [pagination.page]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/disputes', {
        params: { page: pagination.page, limit: pagination.limit },
      });
      setDisputes(response.data.data);
      setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDisputeDetails = async (id) => {
    try {
      const response = await api.get(`/admin/disputes/${id}`);
      setSelectedDispute(response.data.data.dispute);
    } catch (err) {
      console.error('Failed to fetch dispute details:', err);
    }
  };

  const handleResolve = async () => {
    if (!selectedDispute) return;
    setResolving(true);
    try {
      await api.post(`/admin/disputes/${selectedDispute.id}/resolve`, resolution);
      setSelectedDispute(null);
      fetchDisputes();
      setResolution({ decision: 'release_to_host', refundAmount: 0, adminNotes: '' });
    } catch (err) {
      console.error('Failed to resolve dispute:', err);
    } finally {
      setResolving(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      open: 'bg-red-100 text-red-700',
      ai_reviewed: 'bg-yellow-100 text-yellow-700',
      pending_admin: 'bg-orange-100 text-orange-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-baseline gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Link to="/admin/dashboard" className="hover:text-primary-600">Admin</Link>
            <span>/</span>
            <span>Disputes</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Dispute Management</h1>
          <p className="text-gray-600 mt-1">Review and resolve platform disputes</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Disputes List */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Disputes</h2>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : disputes.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600">No pending disputes! 🎉</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {disputes.map(dispute => (
                    <div
                      key={dispute.id}
                      onClick={() => fetchDisputeDetails(dispute.id)}
                      className={`p-5 border rounded-lg cursor-pointer transition-all ${
                        selectedDispute?.id === dispute.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{dispute.chargerName}</p>
                          <p className="text-sm text-gray-500">Driver: {dispute.driverName}</p>
                          <p className="text-sm text-gray-500 mt-1">{dispute.reason}</p>
                        </div>
                        {getStatusBadge(dispute.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <span>Raised by: {dispute.raisedBy}</span>
                        <span>{new Date(dispute.createdAt).toLocaleDateString()}</span>
                      </div>
                      {dispute.aiRecommendation && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                          <span className="text-blue-700">
                            AI suggests: {dispute.aiRecommendation.decision.replace('_', ' ')}
                            {dispute.aiRecommendation.confidence && ` (${(dispute.aiRecommendation.confidence * 100).toFixed(0)}% confidence)`}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {disputes.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    {pagination.total} disputes
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="p-1 border border-gray-300 rounded disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= totalPages}
                      className="p-1 border border-gray-300 rounded disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Dispute Details & Resolution */}
          <Card>
            <CardBody>
              {selectedDispute ? (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Dispute Details</h2>
                  
                  {/* Dispute Info */}
                  <div className="space-y-4 mb-6">
                    <div className="p-5 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Booking Information</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Charger:</span>
                          <p className="text-gray-900">{selectedDispute.booking.charger.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Driver:</span>
                          <p className="text-gray-900">{selectedDispute.booking.driver.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Amount:</span>
                                                    <p className="text-gray-900">${selectedDispute.booking.totalAmount}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Date:</span>
                          <p className="text-gray-900">
                            {new Date(selectedDispute.booking.scheduledStart).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-red-50 rounded-lg">
                      <h4 className="font-medium text-red-900 mb-2">Dispute Reason</h4>
                      <p className="text-red-800">{selectedDispute.reason}</p>
                      {selectedDispute.description && (
                        <p className="text-red-700 text-sm mt-2">{selectedDispute.description}</p>
                      )}
                    </div>

                    {selectedDispute.aiAnalysis && (
                      <div className="p-5 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">AI Analysis</h4>
                        <div className="text-sm text-blue-800">
                          <p><strong>Decision:</strong> {selectedDispute.aiAnalysis.decision.replace('_', ' ')}</p>
                          {selectedDispute.aiAnalysis.refundAmount > 0 && (
                                                        <p><strong>Refund Amount:</strong> ${selectedDispute.aiAnalysis.refundAmount}</p>
                          )}
                          <p><strong>Confidence:</strong> {(selectedDispute.aiAnalysis.confidence * 100).toFixed(0)}%</p>
                          {selectedDispute.aiAnalysis.reasoning && (
                            <p className="mt-2"><strong>Reasoning:</strong> {selectedDispute.aiAnalysis.reasoning}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resolution Form */}
                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Resolution</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Decision</label>
                        <Select
                          value={resolution.decision}
                          onChange={(value) => setResolution(prev => ({ ...prev, decision: value }))}
                          options={[
                            { value: 'release_to_host', label: 'Release Payment to Host' },
                            { value: 'partial_refund', label: 'Partial Refund to Driver' },
                            { value: 'full_refund', label: 'Full Refund to Driver' },
                          ]}
                          className="w-full"
                        />
                      </div>

                      {resolution.decision !== 'release_to_host' && (
                        <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Refund Amount ($)</label>
                          <input
                            type="number"
                            value={resolution.refundAmount}
                            onChange={(e) => setResolution(prev => ({ ...prev, refundAmount: parseFloat(e.target.value) || 0 }))}
                            max={selectedDispute.booking.totalAmount}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                        <textarea
                          value={resolution.adminNotes}
                          onChange={(e) => setResolution(prev => ({ ...prev, adminNotes: e.target.value }))}
                          rows={3}
                          placeholder="Document your reasoning for this decision..."
                          className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={handleResolve}
                          isLoading={resolving}
                          className="flex-1"
                        >
                          Resolve Dispute
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedDispute(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a dispute to view details</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Legal Notice */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> All dispute resolutions are logged for audit purposes and may be subject to 
            legal review. Ensure decisions are made in accordance with platform policies and applicable laws.
            Refunds are processed through PayPal and may take 3-5 business days to reflect.
          </p>
        </div>
      </div>
    </div>
  );
}
