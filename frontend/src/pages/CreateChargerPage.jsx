import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { chargerService } from '../services/chargerService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Loading from '../components/ui/Loading';
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

const CONNECTOR_TYPES = [
  { value: 'Type2', label: 'Type 2 (Mennekes)', description: 'Standard AC connector in India' },
  { value: 'CCS2', label: 'CCS2 (Combined)', description: 'Fast DC charging' },
  { value: 'CHAdeMO', label: 'CHAdeMO', description: 'Japanese DC standard' },
  { value: 'Wall', label: 'Wall Socket', description: 'Standard 15A socket' },
];

// Must match backend createChargerSchema (charger.routes.js)
const MIN_TITLE = 3;
const MIN_ADDRESS = 10;

// Which form step owns each backend field, to send the user back to fix it
const FIELD_STEP = {
  name: 1, description: 1, connectorType: 1, kwTier: 1, packages: 1,
  address: 2, latitude: 2, longitude: 2, amenities: 2, photos: 2,
};

const MAX_PHOTOS = 5;
const MAX_PHOTO_MB = 5;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Backend power tiers (kW) -> enum value
const KW_TIERS = [
  [3.3, 'kW3_3'], [7.4, 'kW7_4'], [11, 'kW11'], [22, 'kW22'], [50, 'kW50'], [150, 'kW150'],
];
const toKwTier = (kw) =>
  KW_TIERS.reduce((best, tier) => (Math.abs(tier[0] - kw) < Math.abs(best[0] - kw) ? tier : best))[1];

const AMENITIES = [
  'WiFi', 'Restroom', 'Cafe', 'Parking', 'Security', 'Covered', 'Seating', 'Water'
];

// Map click handler component
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? <Marker position={position} icon={chargerIcon} /> : null;
}

export default function CreateChargerPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [needsWallet, setNeedsWallet] = useState(false);
  const [step, setStep] = useState(1);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    connectorType: 'Type2',
    powerKw: '',
    pricePerHour: '',
    address: '',
    latitude: 12.9716, // Bengaluru center
    longitude: 77.5946,
    amenities: [],
    instructions: '',
    images: [],
  });

  // Map position state
  const [mapPosition, setMapPosition] = useState([12.9716, 77.5946]);

  // Selected photos: [{ file, preview }]
  const [photos, setPhotos] = useState([]);

  // Release object URLs when the page unmounts
  useEffect(() => () => photos.forEach(p => URL.revokeObjectURL(p.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if not authenticated or not a host
  if (!isAuthenticated) {
    navigate('/login', { state: { from: '/host/chargers/new' } });
    return null;
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleAmenity = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handlePhotoSelect = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // allow picking the same file again
    const accepted = [];
    let problem = null;

    for (const file of picked) {
      if (!PHOTO_TYPES.includes(file.type)) {
        problem = 'Only JPG, PNG or WebP images are allowed';
      } else if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        problem = `"${file.name}" is larger than ${MAX_PHOTO_MB} MB`;
      } else if (photos.length + accepted.length >= MAX_PHOTOS) {
        problem = `You can add up to ${MAX_PHOTOS} photos`;
        break;
      } else {
        accepted.push({ file, preview: URL.createObjectURL(file) });
      }
    }

    setError(problem);
    if (accepted.length) setPhotos(prev => [...prev, ...accepted]);
  };

  const removePhoto = (index) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
    setError(null);
  };

  const makeCover = (index) => {
    setPhotos(prev => [prev[index], ...prev.filter((_, i) => i !== index)]);
  };

  const handleMapClick = (position) => {
    setMapPosition(position);
    setFormData(prev => ({
      ...prev,
      latitude: position[0],
      longitude: position[1],
    }));
  };

  // Same rules as the backend's createChargerSchema, so problems show up on the step where they happen
  const validateStep = (currentStep) => {
    switch (currentStep) {
      case 1:
        if (formData.title.trim().length < MIN_TITLE) return `Charger title must be at least ${MIN_TITLE} characters`;
        if (!formData.connectorType) return 'Please select a connector type';
        if (!formData.powerKw || formData.powerKw <= 0) return 'Please enter power output';
        if (formData.powerKw > 350) return 'Power output can be at most 350 kW';
        if (!formData.pricePerHour || formData.pricePerHour <= 0) return 'Please enter price per hour';
        break;
      case 2:
        if (formData.address.trim().length < MIN_ADDRESS) {
          return `Please enter a full address (at least ${MIN_ADDRESS} characters), e.g. street, area and city`;
        }
        break;
      default:
        break;
    }
    return null;
  };

  const nextStep = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError(null);
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      setNeedsWallet(false);

      // Upload photos first; the first one becomes the cover image
      const photoUrls = photos.length
        ? await chargerService.uploadPhotos(photos.map(p => p.file))
        : [];

      await chargerService.createCharger({
        name: formData.title.trim(),
        description: formData.description,
        connectorType: formData.connectorType,
        kwTier: toKwTier(parseFloat(formData.powerKw)),
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        amenities: formData.amenities,
        photos: photoUrls,
        packages: [
          { name: '1 Hour', durationMin: 60, price: parseFloat(formData.pricePerHour) },
        ],
      });

      navigate('/host/dashboard', { 
        state: { success: 'Charger created successfully!' } 
      });
    } catch (err) {
      // api.js turns server errors into readable text; send the user to the step that needs fixing
      const fieldStep = err.fieldErrors?.map(d => FIELD_STEP[d.field]).find(Boolean);
      if (fieldStep) setStep(fieldStep);
      if (err.apiCode === 'DEPOSIT_REQUIRED') setNeedsWallet(true);
      setError(`Couldn't create your charger. ${err.message || 'Please try again.'}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Add New Charger</h1>
          <p className="text-gray-600 mt-1">
            List your home charger to start earning
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  step >= s
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    step > s ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="p-5 bg-red-50 text-red-700 rounded-lg mb-6">
            {error}
            {needsWallet && (
              <button onClick={() => navigate('/wallet')} className="ml-2 font-medium underline">
                Add money
              </button>
            )}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Basic Information
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Charger Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., Home Charger - Indiranagar"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  A catchy title helps drivers find your charger
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe your charger and location..."
                  rows={3}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Connector Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {CONNECTOR_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => handleChange('connectorType', type.value)}
                      className={`p-6 rounded-lg border-2 text-left transition-colors ${
                        formData.connectorType === type.value
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Power Output (kW) *
                  </label>
                  <Input
                    type="number"
                    value={formData.powerKw}
                    onChange={(e) => handleChange('powerKw', e.target.value)}
                    placeholder="e.g., 7.4"
                    min="1"
                    max="350"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Hour (₹) *
                  </label>
                  <Input
                    type="number"
                    value={formData.pricePerHour}
                    onChange={(e) => handleChange('pricePerHour', e.target.value)}
                    placeholder="e.g., 80"
                    min="1"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <Button onClick={nextStep}>
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Location
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="e.g. 12, 5th Cross, Bellandur, Bengaluru 560103"
                  rows={2}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                {/* Live hint so the minimum length is clear before Continue */}
                <p className={`text-xs mt-1 ${
                  formData.address.trim().length > 0 && formData.address.trim().length < MIN_ADDRESS
                    ? 'text-red-600'
                    : 'text-gray-500'
                }`}>
                  Include street, area and city (at least {MIN_ADDRESS} characters)
                  {formData.address.trim().length > 0 && formData.address.trim().length < MIN_ADDRESS &&
                    ` · ${MIN_ADDRESS - formData.address.trim().length} more needed`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pin Location on Map
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Click on the map to set your exact location
                </p>
                <div className="h-64 rounded-lg overflow-hidden border">
                  <MapContainer
                    center={mapPosition}
                    zoom={13}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker position={mapPosition} setPosition={handleMapClick} />
                  </MapContainer>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amenities
                </label>
                <div className="flex flex-wrap gap-2">
                  {AMENITIES.map((amenity) => (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.amenities.includes(amenity)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photos <span className="text-gray-400 font-normal">({photos.length}/{MAX_PHOTOS})</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Drivers see these when they view your charger. The first photo is the cover. JPG, PNG or WebP, up to {MAX_PHOTO_MB} MB each.
                </p>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {photos.map((photo, index) => (
                    <div key={photo.preview} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={photo.preview} alt={`Charger photo ${index + 1}`} className="w-full h-full object-cover" />
                      {index === 0 ? (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-green-600 text-white text-[10px] rounded">
                          Cover
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => makeCover(index)}
                          className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          Make cover
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-sm leading-none hover:bg-black/80"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {photos.length < MAX_PHOTOS && (
                    <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50 flex flex-col items-center justify-center text-gray-500 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-green-500">
                      <span className="text-2xl leading-none">+</span>
                      <span className="text-xs mt-1">Add photo</span>
                      <input
                        type="file"
                        accept={PHOTO_TYPES.join(',')}
                        multiple
                        onChange={handlePhotoSelect}
                        className="sr-only"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={prevStep}>
                Back
              </Button>
              <Button onClick={nextStep}>
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Review & Submit
            </h2>

            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{formData.title}</h3>
                  {formData.description && (
                    <p className="text-gray-600 text-sm mt-1">{formData.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">Connector:</span>
                    <span className="ml-2 font-medium">{formData.connectorType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Power:</span>
                    <span className="ml-2 font-medium">{formData.powerKw} kW</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Price:</span>
                    <span className="ml-2 font-medium">₹{formData.pricePerHour}/hr</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Platform fee:</span>
                    <span className="ml-2 font-medium">7%</span>
                  </div>
                </div>

                <div>
                  <span className="text-gray-500 text-sm">Address:</span>
                  <p className="font-medium">{formData.address}</p>
                </div>

                {photos.length > 0 && (
                  <div>
                    <span className="text-gray-500 text-sm">Photos:</span>
                    <div className="flex gap-2 mt-1">
                      {photos.map((p, i) => (
                        <img key={p.preview} src={p.preview} alt={`Photo ${i + 1}`} className="w-14 h-14 rounded object-cover border" />
                      ))}
                    </div>
                  </div>
                )}

                {formData.amenities.length > 0 && (
                  <div>
                    <span className="text-gray-500 text-sm">Amenities:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {formData.amenities.map((a) => (
                        <span
                          key={a}
                          className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructions for Drivers (Optional)
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => handleChange('instructions', e.target.value)}
                  placeholder="Any special instructions for accessing or using your charger..."
                  rows={3}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>

              {/* Earnings Estimate */}
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Potential Earnings</h4>
                <p className="text-sm text-green-800">
                  At ₹{formData.pricePerHour}/hr with 2 bookings per day:
                </p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  ~₹{Math.round(formData.pricePerHour * 4 * 30 * 0.93).toLocaleString()}/month
                </p>
                <p className="text-xs text-green-600 mt-1">
                  *After 7% platform fee. Actual earnings depend on demand.
                </p>
              </div>

              {/* Terms */}
              <div className="text-sm text-gray-600">
                By listing your charger, you agree to our{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/host-policy" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                  Host Policy
                </a>.
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={prevStep}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? <Loading size="sm" /> : 'Create Charger'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
