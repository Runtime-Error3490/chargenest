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

// One plain line about where the money is, from the booking's payment and status
function describePayment(booking) {
  const p = booking.payment;
  if (!p?.status) return null;
  const amount = (n) => `₹${Number(n).toFixed(2)}`;
  const green = 'bg-green-50 text-green-800';
  const amber = 'bg-amber-50 text-amber-800';
  const gray = 'bg-gray-100 text-gray-700';
  switch (p.status) {
    case 'authorized':
      return { label: `Payment held: ${amount(p.authorizedAmount ?? booking.totalAmount)}`, detail: 'Taken from your wallet and kept safe. It is paid to the host when the session is done.', className: amber };
    case 'captured':
      return { label: `Paid: ${amount(p.capturedAmount ?? booking.totalAmount)}`, detail: 'The session is complete and the host has been paid.', className: green };
    case 'partially_refunded':
      return { label: `Paid ${amount(p.capturedAmount)}, rest refunded`, detail: 'The unused part went back to your wallet.', className: green };
    case 'refunded':
    case 'voided':
      return { label: 'Refunded', detail: 'The held amount went back to your wallet.', className: gray };
    case 'failed':
      return { label: 'Payment failed', detail: null, className: 'bg-red-50 text-red-800' };
    default:
      return { label: 'Waiting for payment', detail: null, className: amber };
  }
}

const DEVICE_SCENARIOS = [
  { value: 'success', label: 'Success: unlock, charge, end' },
  { value: 'short_session', label: 'Too short: ends after 1 minute' },
  { value: 'bad_meter', label: 'Meter fault: zero energy' },
  { value: 'offline', label: 'Station offline: nothing arrives' },
  { value: 'no_unlock', label: 'Never unlocked' },
  { value: 'fake_station', label: 'Fake station: unknown device' },
];

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [scenario, setScenario] = useState('success');
  const [simResult, setSimResult] = useState(null);
  
  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  
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

  const handleSimulate = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSimResult(await bookingService.simulateDevice(id, scenario));
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
    } catch (err) {
      setError(err.message);
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
      setReviewError(null);
      await bookingService.submitReview(id, {
        rating: reviewRating,
        comment: reviewComment,
      });
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
      setShowReviewModal(false);
      setReviewComment('');
    } catch (err) {
      // Keep the error in the modal; the page-level error replaces the whole page
      setReviewError(err.message);
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
  const paymentLine = describePayment(booking);
  const canCancel = ['pending', 'confirmed'].includes(booking.status);
  const canStartSession = booking.status === 'confirmed' && !timeUntilStart;
  const canEndSession = booking.status === 'active';
  const canDispute = ['completed', 'active'].includes(booking.status);
  // Backend decides: completed booking, right role for this side, not yet reviewed
  const canReview = !!booking.canReview;
  const reviewsDriver = booking.reviewTarget === 'driver';
  const reviewLabel = reviewsDriver ? 'Rate the Driver' : 'Rate this Charger';
  const hasAnyReview = booking.reviews?.charger || booking.reviews?.driver;

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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Charger Info */}
            {booking.charger && (
              <Card className="p-8">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {booking.charger.photos?.[0] ? (
                      <img
                        src={booking.charger.photos[0]}
                        alt={booking.charger.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img src="/charger-placeholder.svg" alt="" className="w-full h-full object-cover" />
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
                    className="self-start whitespace-nowrap !px-3 !py-1 text-xs"
                    onClick={() => navigate(`/chargers/${booking.charger.id}`)}
                  >
                    View Charger
                  </Button>
                </div>
              </Card>
            )}

            {/* Time Slot */}
            <Card className="p-8">
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
              <Card className="p-8">
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
              <Card className="p-8">
                <h3 className="font-semibold text-gray-900 mb-4">Charging Instructions</h3>
                <p className="text-gray-600 whitespace-pre-line">{booking.charger.instructions}</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            {/* Payment Summary */}
            <Card className="p-8">
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
              
              {paymentLine && (
                <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${paymentLine.className}`} role="status">
                  <span className="font-medium">{paymentLine.label}</span>
                  {paymentLine.detail && <span className="block text-xs opacity-80">{paymentLine.detail}</span>}
                </div>
              )}

              {booking.status === 'pending' && (
                <Button
                  className="w-full mt-4"
                  onClick={() => navigate(`/bookings/${id}/confirm`)}
                >
                  Complete Payment
                </Button>
              )}
            </Card>

            {/* Demo only: plays the charger hardware. Shown when the backend has DEVICE_MOCK on (and DEMO_MODE in production) */}
            {booking.deviceMock && booking.status === 'authorized' && (
              <Card className="p-8 border-dashed">
                <h3 className="font-semibold text-gray-900 mb-1">Simulate charger device</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Demo tool. Plays what the charger hardware will send, then pays or refunds the booking.
                </p>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  aria-label="Device scenario"
                >
                  {DEVICE_SCENARIOS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <Button className="w-full" variant="outline" onClick={handleSimulate} disabled={actionLoading}>
                  {actionLoading ? <Loading size="sm" /> : 'Run scenario'}
                </Button>
              </Card>
            )}

            {booking.deviceMock && simResult && (
              <Card className="p-8">
                <h3 className="font-semibold text-gray-900 mb-2">Device result: {simResult.scenario}</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {simResult.steps.map((step, i) => (
                    <li key={i}>
                      {step.ok ? '✓' : '✗'} {step.type}
                      {step.outcome ? ` → ${step.outcome}${step.reason ? ` (${step.reason})` : ''}` : ''}
                      {!step.ok ? ` → ${step.code}: ${step.message}` : ''}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-500 mt-3">
                  Booking: {simResult.booking?.status}. Session: {simResult.session?.outcome || simResult.session?.status}.
                  Check /wallet for the money moves.
                </p>
              </Card>
            )}

            {/* Actions */}
            <Card className="p-8">
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
                    onClick={() => { setReviewError(null); setShowReviewModal(true); }}
                  >
                    {reviewLabel}
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

            {/* Reviews left on this booking (both directions) */}
            {hasAnyReview && (
              <Card className="p-8">
                <h3 className="font-semibold text-gray-900 mb-4">Reviews</h3>
                <div className="space-y-4">
                  {[
                    ['Driver → Charger', booking.reviews.charger],
                    ['Host → Driver', booking.reviews.driver],
                  ].filter(([, r]) => r).map(([label, r]) => (
                    <div key={label}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">{label}</span>
                        <span className="text-yellow-500" aria-label={`${r.rating} out of 5 stars`}>
                          {'★'.repeat(r.rating)}<span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span>
                        </span>
                      </div>
                      {r.reviewText && <p className="text-sm text-gray-700 mt-1">{r.reviewText}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Driver (host view) */}
            {booking.driver && (
              <Card className="p-8">
                <h3 className="font-semibold text-gray-900 mb-4">Driver</h3>
                <p className="font-medium">{booking.driver.name}</p>
                <p className="text-sm text-gray-600">
                  {booking.driver.totalReviews > 0
                    ? `★ ${booking.driver.avgRating.toFixed(1)} from ${booking.driver.totalReviews} host review${booking.driver.totalReviews === 1 ? '' : 's'}`
                    : 'No host reviews yet'}
                </p>
              </Card>
            )}

            {/* Host Contact */}
            {booking.charger?.host && (
              <Card className="p-8">
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
        title={reviewLabel}
      >
        <div className="space-y-4">
          {reviewError && (
            <p className="p-3 bg-red-50 text-red-700 text-sm rounded-lg" role="alert">{reviewError}</p>
          )}
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
