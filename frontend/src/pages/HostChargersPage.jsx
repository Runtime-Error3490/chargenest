import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chargerService } from '../services/chargerService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  MapPin, 
  Zap, 
  Star, 
  LayoutGrid,
  ChevronRight,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Power,
  ArrowLeft
} from 'lucide-react';

export default function HostChargersPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [chargers, setChargers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/host/chargers' } });
      return;
    }

    if (!user?.roles?.includes('host')) {
      navigate('/host/register');
      return;
    }

    fetchChargers();
  }, [isAuthenticated, navigate, user]);

  const fetchChargers = async () => {
    try {
      setLoading(true);
      const response = await chargerService.getMyChargers();
      setChargers(response.data || []);
    } catch (err) {
      console.error('Failed to load chargers:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (charger) => {
    try {
      setActionLoading(charger.id);
      const newStatus = charger.status === 'active' ? 'inactive' : 'active';
      await chargerService.updateCharger(charger.id, { status: newStatus });
      setChargers(prev => prev.map(c => 
        c.id === charger.id ? { ...c, status: newStatus } : c
      ));
    } catch (err) {
      console.error('Failed to update charger:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteCharger = async (chargerId) => {
    try {
      setActionLoading(chargerId);
      await chargerService.deleteCharger(chargerId);
      setChargers(prev => prev.filter(c => c.id !== chargerId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete charger:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredChargers = chargers.filter(charger => {
    if (filter === 'active') return charger.status === 'active';
    if (filter === 'inactive') return charger.status !== 'active';
    return true;
  });

  const activeCount = chargers.filter(c => c.status === 'active').length;
  const inactiveCount = chargers.filter(c => c.status !== 'active').length;

  const filters = [
    { key: 'all', label: 'All Chargers', count: chargers.length, icon: LayoutGrid },
    { key: 'active', label: 'Active', count: activeCount, icon: CheckCircle },
    { key: 'inactive', label: 'Inactive', count: inactiveCount, icon: EyeOff },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 dark:from-emerald-800 dark:via-green-800 dark:to-teal-800">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">My Chargers</h1>
                <p className="text-green-100">
                  Manage all your EV charging stations
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => navigate('/host/dashboard')}
                className="border-white/30 text-white hover:bg-white/10 bg-white/5"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <Button 
                onClick={() => navigate('/host/chargers/new')}
                className="bg-white text-green-600 hover:bg-green-50 shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Charger
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-6 pb-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="p-5 bg-white dark:bg-gray-800 border-0 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Chargers</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{chargers.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-white dark:bg-gray-800 border-0 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-white dark:bg-gray-800 border-0 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Inactive</p>
                <p className="text-3xl font-bold text-gray-400">{inactiveCount}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center shadow-lg shadow-gray-500/25">
                <EyeOff className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {filters.map(f => {
            const Icon = f.icon;
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {f.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Chargers List */}
        {filteredChargers.length === 0 ? (
          <Card className="text-center py-16 bg-white dark:bg-gray-800 border-0 shadow-lg">
            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Zap className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {filter === 'all' ? 'No chargers yet' : `No ${filter} chargers`}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {filter === 'all' 
                ? 'Start earning by adding your first EV charger to the marketplace'
                : `You don't have any ${filter} chargers at the moment`
              }
            </p>
            {filter === 'all' && (
              <Button 
                onClick={() => navigate('/host/chargers/new')}
                className="bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/25"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Charger
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredChargers.map(charger => (
              <Card 
                key={charger.id} 
                className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4 p-5">
                  {/* Image */}
                  <div 
                    className="w-full md:w-36 h-36 bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer group"
                    onClick={() => navigate(`/chargers/${charger.id}`)}
                  >
                    {charger.photos?.[0] ? (
                      <img
                        src={charger.photos[0]}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Zap className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 
                        className="text-lg font-semibold text-gray-900 dark:text-white truncate cursor-pointer hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        onClick={() => navigate(`/chargers/${charger.id}`)}
                      >
                        {charger.name}
                      </h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        charger.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {charger.status === 'active' ? '● Active' : '○ Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-3">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{charger.address}</span>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                          {charger.connectorType}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <Power className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                          {charger.kwTier}
                        </span>
                      </div>
                      {charger.avgRating > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                            {charger.avgRating.toFixed(1)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {charger.totalBookings || 0} bookings
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex md:flex-col gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/chargers/${charger.id}`)}
                      className="flex-1 md:flex-none dark:border-gray-600 dark:text-gray-300"
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/host/chargers/${charger.id}/edit`)}
                      className="flex-1 md:flex-none dark:border-gray-600 dark:text-gray-300"
                    >
                      <Edit className="w-4 h-4 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant={charger.status === 'active' ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => toggleAvailability(charger)}
                      disabled={actionLoading === charger.id}
                      className={`flex-1 md:flex-none ${
                        charger.status === 'active' 
                          ? 'dark:border-gray-600 dark:text-gray-300' 
                          : 'bg-gradient-to-r from-green-500 to-emerald-600'
                      }`}
                    >
                      {actionLoading === charger.id ? (
                        <Loading size="sm" />
                      ) : charger.status === 'active' ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-1.5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1.5" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(charger.id)}
                      className="flex-1 md:flex-none text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6 bg-white dark:bg-gray-800 border-0 shadow-2xl">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
                Delete Charger?
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
                Are you sure you want to delete this charger? This action cannot be undone.
                All bookings for this charger will also be affected.
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 dark:border-gray-600 dark:text-gray-300"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => deleteCharger(deleteConfirm)}
                  disabled={actionLoading === deleteConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {actionLoading === deleteConfirm ? <Loading size="sm" /> : 'Delete'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
