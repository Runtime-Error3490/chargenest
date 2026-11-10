import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chargerService } from '../services/chargerService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import { Plus, Edit, Trash2, Eye, EyeOff, MapPin, Zap, Star } from 'lucide-react';

export default function HostChargersPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [chargers, setChargers] = useState([]);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
      const newStatus = charger.status === 'active' ? 'inactive' : 'active';
      await chargerService.updateCharger(charger.id, {
        status: newStatus
      });
      setChargers(prev => prev.map(c => 
        c.id === charger.id ? { ...c, status: newStatus } : c
      ));
    } catch (err) {
      console.error('Failed to update charger:', err);
    }
  };

  const deleteCharger = async (chargerId) => {
    try {
      await chargerService.deleteCharger(chargerId);
      setChargers(prev => prev.filter(c => c.id !== chargerId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete charger:', err);
    }
  };

  const filteredChargers = chargers.filter(charger => {
    if (filter === 'active') return charger.status === 'active';
    if (filter === 'inactive') return charger.status !== 'active';
    return true;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Chargers</h1>
            <p className="text-gray-600 mt-1">
              Manage all your EV charging stations
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/host/dashboard')}>
              ← Back to Dashboard
            </Button>
            <Button onClick={() => navigate('/host/chargers/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Charger
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <Card className="text-center p-6">
            <div className="text-3xl font-bold text-gray-900">{chargers.length}</div>
            <div className="text-sm text-gray-600 mt-1">Total Chargers</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-3xl font-bold text-green-600">
              {chargers.filter(c => c.status === 'active').length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Active</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-3xl font-bold text-gray-400">
              {chargers.filter(c => c.status !== 'active').length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Inactive</div>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'active', 'inactive'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'all' && ` (${chargers.length})`}
              {f === 'active' && ` (${chargers.filter(c => c.status === 'active').length})`}
              {f === 'inactive' && ` (${chargers.filter(c => c.status !== 'active').length})`}
            </button>
          ))}
        </div>

        {/* Chargers List */}
        {filteredChargers.length === 0 ? (
          <Card className="text-center py-16 p-6">
            <div className="text-6xl mb-4">🔌</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {filter === 'all' ? 'No chargers yet' : `No ${filter} chargers`}
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all' 
                ? 'Add your first charger to start earning'
                : `You don't have any ${filter} chargers`
              }
            </p>
            {filter === 'all' && (
              <Button onClick={() => navigate('/host/chargers/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Charger
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredChargers.map(charger => (
              <Card key={charger.id} className="p-6">
                <div className="flex items-start gap-6">
                  {/* Image */}
                  <div className="w-32 h-32 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                    {charger.photos?.[0] ? (
                      <img
                        src={charger.photos[0]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img src="/charger-placeholder.svg" alt="" className="w-full h-full object-cover" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 truncate">
                        {charger.name}
                      </h3>
                      <Badge
                        variant={charger.status === 'active' ? 'success' : 'default'}
                        size="sm"
                      >
                        {charger.status === 'active' ? 'Active' : charger.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600 mb-3">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{charger.address}</span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span>{charger.connectorType}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Power Tier:</span>{' '}
                        <span className="font-medium">{charger.kwTier}</span>
                      </div>
                      {charger.avgRating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{charger.avgRating.toFixed(1)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Bookings:</span>{' '}
                        <span className="font-medium">{charger.totalBookings || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Packages:</span>{' '}
                        <span className="font-medium">{charger.packagesCount || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/chargers/${charger.id}`)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/host/chargers/${charger.id}/edit`)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant={charger.status === 'active' ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => toggleAvailability(charger)}
                    >
                      {charger.status === 'active' ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteConfirm(charger.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Delete Charger?
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this charger? This action cannot be undone.
                All bookings for this charger will also be affected.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => deleteCharger(deleteConfirm)}>
                  Delete
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
