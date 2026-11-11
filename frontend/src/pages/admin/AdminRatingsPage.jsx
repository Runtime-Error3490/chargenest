import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, Filter, ChevronLeft, ChevronRight, User, Zap,
  MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { Card, CardBody, Button } from '../../components/ui';
import api from '../../services/api';

export default function AdminRatingsPage() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [ratingType, setRatingType] = useState(''); // '' for all, 'driver', 'host'
  const [stats, setStats] = useState({ avgDriver: null, avgHost: null, total: 0 });

  useEffect(() => {
    fetchRatings();
  }, [pagination.page, ratingType]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchRatings = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (ratingType) params.type = ratingType;
      
      const response = await api.get('/admin/ratings', { params });
      setRatings(response.data.data);
      setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
    } catch (err) {
      console.error('Failed to fetch ratings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/dashboard');
      const { ratings: ratingStats } = response.data.data;
      setStats({
        avgDriver: ratingStats.avgDriverRating,
        avgHost: ratingStats.avgHostRating,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-baseline gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Link to="/admin/dashboard" className="hover:text-primary-600">Admin</Link>
            <span>/</span>
            <span>Ratings & Reviews</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Ratings & Reviews</h1>
          <p className="text-gray-600 mt-1">Monitor and moderate user feedback</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg. Charger Rating</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.avgDriver !== null ? stats.avgDriver : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">By drivers rating chargers</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg. Driver Rating</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.avgHost !== null ? stats.avgHost : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">By hosts rating drivers</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Reviews</p>
                  <p className="text-3xl font-bold text-gray-900">{pagination.total}</p>
                  <p className="text-xs text-gray-400 mt-1">All time</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">Filter by type:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setRatingType('')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    ratingType === ''
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All Reviews
                </button>
                <button
                  onClick={() => setRatingType('driver')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    ratingType === 'driver'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Charger Reviews
                </button>
                <button
                  onClick={() => setRatingType('host')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    ratingType === 'host'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Driver Reviews
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Ratings List */}
        <Card>
          <CardBody>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : ratings.length === 0 ? (
              <div className="text-center py-12">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No reviews found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ratings.map(rating => (
                  <div
                    key={rating.id}
                    className="p-5 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            rating.type === 'driver'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {rating.type === 'driver' ? 'Charger Review' : 'Driver Review'}
                          </span>
                          {renderStars(rating.rating)}
                          <span className="text-sm font-medium text-gray-900">{rating.rating}/5</span>
                        </div>
                        
                        <div className="mb-2">
                          <span className="text-sm text-gray-500">
                            <strong className="text-gray-700">{rating.reviewer}</strong>
                            {' reviewed '}
                            <strong className="text-gray-700">{rating.subject}</strong>
                            {rating.subjectOwner && (
                              <span className="text-gray-400"> (owned by {rating.subjectOwner})</span>
                            )}
                          </span>
                        </div>

                        {rating.review ? (
                          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                            "{rating.review}"
                          </p>
                        ) : (
                          <p className="text-gray-400 italic">No written review</p>
                        )}
                      </div>
                      
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-400">
                          {new Date(rating.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {ratings.length > 0 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} reviews
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
            )}
          </CardBody>
        </Card>

        {/* Info Notice */}
        <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Reviews are collected after each completed charging session. 
            Charger reviews are submitted by drivers, and driver reviews are submitted by hosts.
            All reviews are subject to our community guidelines.
          </p>
        </div>
      </div>
    </div>
  );
}
