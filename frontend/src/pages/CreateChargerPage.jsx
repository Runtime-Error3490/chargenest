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
import {
  Zap,
  MapPin,
  Camera,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Info,
  DollarSign,
  Gauge,
  FileText,
  Wifi,
  Car,
  Shield,
  Umbrella,
  Coffee,
  Droplets,
  Armchair,
  Bath,
  AlertTriangle,
  Sparkles,
  TrendingUp
} from 'lucide-react';

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
  { value: 'Type2', label: 'Type 2', description: 'Standard AC connector', icon: '🔌' },
  { value: 'CCS2', label: 'CCS2', description: 'Fast DC charging', icon: '⚡' },
  { value: 'CHAdeMO', label: 'CHAdeMO', description: 'Japanese DC standard', icon: '🔋' },
  { value: 'Wall', label: 'Wall Socket', description: 'Standard 15A socket', icon: '🏠' },
];

const MIN_TITLE = 3;
const MIN_ADDRESS = 10;

const FIELD_STEP = {
  name: 1, description: 1, connectorType: 1, kwTier: 1, packages: 1,
  address: 2, latitude: 2, longitude: 2, amenities: 2, photos: 2,
};

const MAX_PHOTOS = 5;
const MAX_PHOTO_MB = 5;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const KW_TIERS = [
  [3.3, 'kW3_3'], [7.4, 'kW7_4'], [11, 'kW11'], [22, 'kW22'], [50, 'kW50'], [150, 'kW150'],
];
const toKwTier = (kw) =>
  KW_TIERS.reduce((best, tier) => (Math.abs(tier[0] - kw) < Math.abs(best[0] - kw) ? tier : best))[1];

const AMENITIES = [
  { id: 'WiFi', label: 'WiFi', icon: Wifi },
  { id: 'Restroom', label: 'Restroom', icon: Bath },
  { id: 'Cafe', label: 'Cafe', icon: Coffee },
  { id: 'Parking', label: 'Parking', icon: Car },
  { id: 'Security', label: 'Security', icon: Shield },
  { id: 'Covered', label: 'Covered', icon: Umbrella },
  { id: 'Seating', label: 'Seating', icon: Armchair },
  { id: 'Water', label: 'Water', icon: Droplets },
];

const STEPS = [
  { number: 1, label: 'Basic Info', icon: Info },
  { number: 2, label: 'Location', icon: MapPin },
  { number: 3, label: 'Review', icon: CheckCircle },
];

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
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    connectorType: 'Type2',
    powerKw: '',
    pricePerHour: '',
    address: '',
    latitude: 12.9716,
    longitude: 77.5946,
    amenities: [],
    instructions: '',
    images: [],
  });

  const [mapPosition, setMapPosition] = useState([12.9716, 77.5946]);
  const [photos, setPhotos] = useState([]);

  useEffect(() => () => photos.forEach(p => URL.revokeObjectURL(p.preview)), []);

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
    e.target.value = '';
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
          return `Please enter a full address (at least ${MIN_ADDRESS} characters)`;
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 dark:from-emerald-800 dark:via-green-800 dark:to-teal-800">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Back
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Add New Charger</h1>
              <p className="text-green-100">List your home charger to start earning</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6 pb-8">
        {/* Progress Steps */}
        <Card className="p-4 bg-white dark:bg-gray-800 border-0 shadow-lg mb-6">
          <div className="flex items-center justify-between">
            {STEPS.map((s, index) => {
              const Icon = s.icon;
              const isCompleted = step > s.number;
              const isCurrent = step === s.number;
              return (
                <div key={s.number} className="flex items-center flex-1">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-medium transition-all ${
                      isCompleted
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                        : isCurrent
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}>
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <div className="hidden sm:block">
                      <p className={`text-sm font-medium ${
                        isCurrent ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        Step {s.number}
                      </p>
                      <p className={`text-xs ${
                        isCurrent ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                      }`}>
                        {s.label}
                      </p>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 rounded-full ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 dark:text-red-300">{error}</p>
              {needsWallet && (
                <button 
                  onClick={() => navigate('/wallet')} 
                  className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 underline"
                >
                  Add money to wallet →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card className="p-6 bg-white dark:bg-gray-800 border-0 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Tell us about your charger</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Charger Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., Home Charger - Downtown"
                  maxLength={100}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  A catchy title helps drivers find your charger
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe your charger and location..."
                  rows={3}
                  className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500 p-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Connector Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {CONNECTOR_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => handleChange('connectorType', type.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.connectorType === type.value
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-lg shadow-green-500/10'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{type.icon}</span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{type.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{type.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-blue-500" />
                      Power Output (kW) *
                    </div>
                  </label>
                  <Input
                    type="number"
                    value={formData.powerKw}
                    onChange={(e) => handleChange('powerKw', e.target.value)}
                    placeholder="e.g., 7.4"
                    min="1"
                    max="350"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      Price per Hour ($) *
                    </div>
                  </label>
                  <Input
                    type="number"
                    value={formData.pricePerHour}
                    onChange={(e) => handleChange('pricePerHour', e.target.value)}
                    placeholder="e.g., 5"
                    min="1"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <Button 
                onClick={nextStep}
                className="bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/25"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <Card className="p-6 bg-white dark:bg-gray-800 border-0 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Location & Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Help drivers find your charger</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Address *
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="e.g. 123 Main Street, City, State 12345"
                  rows={2}
                  className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500 p-4"
                />
                <p className={`text-xs mt-1.5 ${
                  formData.address.trim().length > 0 && formData.address.trim().length < MIN_ADDRESS
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  Include street, area and city (at least {MIN_ADDRESS} characters)
                  {formData.address.trim().length > 0 && formData.address.trim().length < MIN_ADDRESS &&
                    ` · ${MIN_ADDRESS - formData.address.trim().length} more needed`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pin Location on Map
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Click on the map to set your exact location
                </p>
                <div className="h-64 rounded-xl overflow-hidden border dark:border-gray-600">
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  📍 Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Amenities
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AMENITIES.map((amenity) => {
                    const Icon = amenity.icon;
                    const isSelected = formData.amenities.includes(amenity.id);
                    return (
                      <button
                        key={amenity.id}
                        onClick={() => toggleAmenity(amenity.id)}
                        className={`p-3 rounded-xl text-center transition-all ${
                          isSelected
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <Icon className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-xs font-medium">{amenity.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-purple-500" />
                    Photos
                    <span className="text-gray-400 font-normal">({photos.length}/{MAX_PHOTOS})</span>
                  </div>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Add photos to attract more drivers. The first photo is the cover image.
                </p>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {photos.map((photo, index) => (
                    <div key={photo.preview} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                      <img src={photo.preview} alt={`Charger photo ${index + 1}`} className="w-full h-full object-cover" />
                      {index === 0 ? (
                        <span className="absolute bottom-1 left-1 px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[10px] font-medium rounded-full">
                          Cover
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => makeCover(index)}
                          className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Make cover
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-sm leading-none hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {photos.length < MAX_PHOTOS && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 flex flex-col items-center justify-center text-gray-400 cursor-pointer transition-all">
                      <Camera className="w-6 h-6 mb-1" />
                      <span className="text-xs">Add photo</span>
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
              <Button 
                variant="outline" 
                onClick={prevStep}
                className="dark:border-gray-600 dark:text-gray-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={nextStep}
                className="bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/25"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <Card className="p-6 bg-white dark:bg-gray-800 border-0 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review & Submit</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Make sure everything looks good</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{formData.title}</h3>
                  {formData.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{formData.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <Zap className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Connector</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formData.connectorType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <Gauge className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Power</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formData.powerKw} kW</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
                      <p className="font-medium text-gray-900 dark:text-white">${formData.pricePerHour}/hr</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Platform Fee</p>
                      <p className="font-medium text-gray-900 dark:text-white">7%</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <MapPin className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
                    <p className="font-medium text-gray-900 dark:text-white">{formData.address}</p>
                  </div>
                </div>

                {photos.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Photos</p>
                    <div className="flex gap-2">
                      {photos.map((p, i) => (
                        <img key={p.preview} src={p.preview} alt={`Photo ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border dark:border-gray-600" />
                      ))}
                    </div>
                  </div>
                )}

                {formData.amenities.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Amenities</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.amenities.map((a) => (
                        <span
                          key={a}
                          className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Instructions for Drivers (Optional)
                  </div>
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => handleChange('instructions', e.target.value)}
                  placeholder="Any special instructions for accessing or using your charger..."
                  rows={3}
                  className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500 p-4"
                />
              </div>

              {/* Earnings Estimate */}
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5" />
                  <h4 className="font-semibold">Potential Earnings</h4>
                </div>
                <p className="text-green-100 text-sm">
                  At ${formData.pricePerHour}/hr with 2 bookings per day:
                </p>
                <p className="text-3xl font-bold mt-2">
                  ~${Math.round(formData.pricePerHour * 4 * 30 * 0.93).toLocaleString()}/month
                </p>
                <p className="text-xs text-green-200 mt-2">
                  *After 7% platform fee. Actual earnings depend on demand.
                </p>
              </div>

              {/* Terms */}
              <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                By listing your charger, you agree to our{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 dark:text-green-400 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/host-policy" target="_blank" rel="noopener noreferrer" className="text-green-600 dark:text-green-400 hover:underline">
                  Host Policy
                </a>.
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button 
                variant="outline" 
                onClick={prevStep}
                className="dark:border-gray-600 dark:text-gray-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={loading}
                className="bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/25"
              >
                {loading ? <Loading size="sm" /> : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Create Charger
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
