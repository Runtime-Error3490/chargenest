import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { bookingService } from '../services/bookingService';
import { disputeService } from '../services/disputeService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import 'leaflet/dist/leaflet.css';

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const chargerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const STATUS_CONFIG = {
  pending: { label: 'Pending Payment', variant: 'warning', color: 'yellow' },
  authorized: { label: 'Confirmed', variant: 'success', color: 'green' },
  confirmed: { label: 'Confirmed', variant: 'success', color: 'green' },
  in_progress: { label: 'In Progress', variant: 'primary', color: 'blue' },
  active: { label: 'In Progress', variant: 'primary', color: 'blue' },
  completed: { label: 'Completed', variant: 'default', color: 'gray' },
  cancelled: { label: 'Cancelled', variant: 'error', color: 'red' },
  no_show: { label: 'No Show', variant: 'error', color: 'red' },
  disputed: { label: 'Disputed', variant: 'warning', color: 'orange' },
};

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  
  // Form states
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Payment success notification
  const paymentSuccess = location.state?.paymentSuccess;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/bookings/${id}` } });
      return;
    }

    const fetchBooking = async () => {
      try {
        setLoading(true);
        const response = await bookingService.getBookingById(id);
        setBooking(response.data);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [id, isAuthenticated, navigate]);

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  };

  const calculateDuration = () => {
    if (!booking) return 0;
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    return Math.round((end - start) / (1000 * 60 * 60));
  };

  const getTimeUntilStart = () => {
    if (!booking) return null;
    const now = new Date();
    const start = new Date(booking.startTime);
    const diff = start - now;
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      return `${Math.floor(hours / 24)} days`;
    }
    return `${hours}h ${minutes}m`;
  };

  const getCancellationFee = () => {
    if (!booking) return 0;
    const now = new Date();
    const start = new Date(booking.startTime);
    const hoursUntil = (start - now) / (1000 * 60 * 60);
    
    if (hoursUntil >= 24) return 0;
    if (hoursUntil >= 12) return booking.totalAmount * 0.25;
    if (hoursUntil >= 6) return booking.totalAmount * 0.50;
    return booking.totalAmount;
  };

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await bookingService.cancelBooking(id);
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
      setShowCancelModal(false);
    } catch (err) {
      setError(err.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartSession = async () => {
    try {
      setActionLoading(true);
      await bookingService.startSession(id);
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
    } catch (err) {
      setError(err.message || 'Failed to start session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndSession = async () => {
    try {
      setActionLoading(true);
      await bookingService.endSession(id);
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
    } catch (err) {
      setError(err.message || 'Failed to end session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason || !disputeDescription) {
      return;
    }
    
    try {
      setActionLoading(true);
      await disputeService.createDispute({
        bookingId: id,
        reason: disputeReason,
        description: disputeDescription,
      });
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
      setShowDisputeModal(false);
      setDisputeReason('');
      setDisputeDescription('');
    } catch (err) {
      setError(err.message || 'Failed to create dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async () => {
    try {
      setActionLoading(true);
      await bookingService.submitReview(id, {
        rating: reviewRating,
        comment: reviewComment,
      });
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
      setShowReviewModal(false);
    } catch (err) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking not found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/bookings')}>View All Bookings</Button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const timeUntilStart = getTimeUntilStart();
  const isUpcoming = booking.status === 'confirmed' && timeUntilStart;
  const canCancel = ['pending', 'confirmed'].includes(booking.status);
  const canStartSession = booking.status === 'confirmed' && !timeUntilStart;
  const canEndSession = booking.status === 'active';
  const canDispute = ['completed', 'active'].includes(booking.status);
  const canReview = booking.status === 'completed' && !booking.review;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => navigate('/bookings')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Bookings
        </button>

        {/* Payment Success Banner */}
        {paymentSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="font-semibold text-green-800">Payment Successful!</h3>
              <p className="text-sm text-green-700">Your booking has been confirmed.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Booking Details</h1>
            <p className="text-gray-600 mt-1">ID: {booking.id.slice(0, 8)}</p>
          </div>
          <Badge variant={statusConfig.variant} size="lg">
            {statusConfig.label}
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Charger Info */}
            {booking.charger && (
              <Card className="p-6">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {booking.charger.photos?.[0] ? (
                      <img
                        src={booking.charger.photos[0]}
                        alt={booking.charger.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        ⚡
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{booking.charger.name}</h3>
                    <p className="text-gray-600">{booking.charger.address}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge>{booking.charger.connectorType}</Badge>
                      <span className="text-sm text-gray-600">{booking.charger.kwTier?.replace('kW', '')} kW</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/chargers/${booking.charger.id}`)}
                  >
                    View Charger
                  </Button>
                </div>
              </Card>
            )}

            {/* Time Slot */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Booking Time</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Start</p>
                  <p className="font-medium">{formatDateTime(booking.startTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">End</p>
                  <p className="font-medium">{formatDateTime(booking.endTime)}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-gray-600">Duration</span>
                <span className="font-medium">{calculateDuration()} hours</span>
              </div>
              
              {isUpcoming && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-green-800 font-medium">
                    Starts in {timeUntilStart}
                  </p>
                </div>
              )}
            </Card>

            {/* Location Map */}
            {booking.charger && (
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Location</h3>
                <div className="h-48 rounded-lg overflow-hidden">
                  <MapContainer
                    center={[booking.charger.latitude, booking.charger.longitude]}
                    zoom={15}
                    className="h-full w-full"
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker 
                      position={[booking.charger.latitude, booking.charger.longitude]} 
                      icon={chargerIcon}
                    >
                      <Popup>{booking.charger.name}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
                <div className="mt-4">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${booking.charger.latitude},${booking.charger.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-green-600 hover:text-green-700"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Get Directions
                  </a>
                </div>
              </Card>
            )}

            {/* Instructions */}
            {booking.charger?.instructions && (
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Charging Instructions</h3>
                <p className="text-gray-600 whitespace-pre-line">{booking.charger.instructions}</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Payment Summary */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Charging fee</span>
                  <span>₹{(booking.totalAmount * 0.93).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Platform fee (7%)</span>
                  <span>₹{(booking.totalAmount * 0.07).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-3 border-t">
                  <span>Total</span>
                  <span>₹{booking.totalAmount.toFixed(2)}</span>
                </div>
              </div>
              
              {booking.status === 'pending' && (
                <Button
                  className="w-full mt-4"
                  onClick={() => navigate(`/bookings/${id}/confirm`)}
                >
                  Complete Payment
                </Button>
              )}
            </Card>

            {/* Actions */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                {canStartSession && (
                  <Button
                    className="w-full"
                    onClick={handleStartSession}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loading size="sm" /> : 'Start Charging'}
                  </Button>
                )}
                
                {canEndSession && (
                  <Button
                    className="w-full"
                    onClick={handleEndSession}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loading size="sm" /> : 'End Session'}
                  </Button>
                )}

                {canReview && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setShowReviewModal(true)}
                  >
                    Leave Review
                  </Button>
                )}
                
                {canCancel && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setShowCancelModal(true)}
                  >
                    Cancel Booking
                  </Button>
                )}
                
                {canDispute && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setShowDisputeModal(true)}
                  >
                    Report Issue
                  </Button>
                )}

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate('/chat')}
                >
                  Contact Support
                </Button>
              </div>
            </Card>

            {/* Host Contact */}
            {booking.charger?.host && (
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Host</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-700 font-medium text-lg">
                      {booking.charger.host.name?.[0] || 'H'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{booking.charger.host.name}</p>
                    <p className="text-sm text-gray-600">Charger Host</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Booking"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to cancel this booking?
          </p>
          
          {getCancellationFee() > 0 && (
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-yellow-800 font-medium">
                Cancellation fee: ₹{getCancellationFee().toFixed(2)}
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                This fee will be deducted from your refund.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCancelModal(false)}
            >
              Keep Booking
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              {actionLoading ? <Loading size="sm" /> : 'Cancel Booking'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dispute Modal */}
      <Modal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Report an Issue"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Issue Type
            </label>
            <Select
              value={disputeReason}
              onChange={setDisputeReason}
              placeholder="Select an issue..."
              options={[
                { value: 'charger_not_working', label: 'Charger not working' },
                { value: 'wrong_location', label: 'Wrong location' },
                { value: 'access_issue', label: "Couldn't access charger" },
                { value: 'safety_concern', label: 'Safety concern' },
                { value: 'billing_issue', label: 'Billing issue' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={disputeDescription}
              onChange={(e) => setDisputeDescription(e.target.value)}
              rows={4}
              placeholder="Please describe the issue in detail..."
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <p className="text-sm text-gray-500">
            Our AI will review your case. If confidence is below 95%, a human agent will assist.
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDisputeModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleDispute}
              disabled={actionLoading || !disputeReason || !disputeDescription}
            >
              {actionLoading ? <Loading size="sm" /> : 'Submit Report'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="Leave a Review"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className={`text-3xl ${
                    star <= reviewRating ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comment (optional)
            </label>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
              placeholder="Share your experience..."
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowReviewModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleReview}
              disabled={actionLoading}
            >
              {actionLoading ? <Loading size="sm" /> : 'Submit Review'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
