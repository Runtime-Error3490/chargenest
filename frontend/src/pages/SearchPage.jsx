import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { chargerService } from '../services/chargerService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import StarRating from '../components/ui/StarRating';
import ImageCarousel from '../components/ui/ImageCarousel';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  MapPin,
  Zap,
  Battery,
  Wifi,
  Coffee,
  Car,
  Shield,
  Armchair,
  X,
  Filter,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom charger icon
const chargerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to recenter map
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

// Map kW tier to numeric value
const kwTierToNumber = {
  'kW3_3': 3.3,
  'kW7_4': 7.4,
  'kW11': 11,
  'kW22': 22,
  'kW50': 50,
  'kW150': 150,
};

// Number filter: blocks negatives / exponent chars, clamps to max, shows inline hint
function NumberFilter({ label, value, onChange, placeholder, unit, min = 0, max, step = 1 }) {
  const [hint, setHint] = useState('');

  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setHint('');
      onChange('');
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    if (num < min) {
      setHint(`Must be ${min} or more`);
      return;
    }
    if (max !== undefined && num > max) {
      setHint(`Max allowed is ${max}`);
      onChange(String(max));
      return;
    }
    setHint('');
    onChange(raw);
  };

  const blockInvalidKeys = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
      setHint('Enter a positive number');
    }
  };

  return (
    <div className="relative flex-shrink-0">
      <label className="sr-only">{label}</label>
      <div
        className={`flex items-center rounded-lg border bg-white dark:bg-gray-700 px-3 h-10 transition-colors focus-within:ring-2 ${
          hint
            ? 'border-red-400 focus-within:ring-red-200'
            : 'border-gray-300 dark:border-gray-600 focus-within:border-green-500 focus-within:ring-green-200 dark:focus-within:ring-green-800'
        }`}
      >
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={!!hint}
          onKeyDown={blockInvalidKeys}
          onChange={handleChange}
          onBlur={() => setHint('')}
          onWheel={(e) => e.target.blur()}
          className="w-20 bg-transparent text-sm outline-none border-0 p-0 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 whitespace-nowrap">{unit}</span>
        {value !== '' && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => { setHint(''); onChange(''); }}
            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-base leading-none"
          >
            ×
          </button>
        )}
      </div>
      {hint && (
        <p className="absolute left-0 top-11 text-xs text-red-600 whitespace-nowrap" role="alert">
          {hint}
        </p>
      )}
    </div>
  );
}

const POWER_PRESETS = [7, 11, 22, 50];

const AMENITY_ICONS = {
  wifi: Wifi,
  restroom: null, // Will use emoji fallback
  cafe: Coffee,
  parking: Car,
  security: Shield,
  seating: Armchair,
};

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCharger, setSelectedCharger] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    connectorType: searchParams.get('connector') || '',
    minPower: Number(searchParams.get('minPower')) > 0 ? searchParams.get('minPower') : '',
    maxPrice: Number(searchParams.get('maxPrice')) > 0 ? searchParams.get('maxPrice') : '',
    amenities: searchParams.get('amenities')?.split(',').filter(Boolean) || [],
  });
  
  // Bengaluru center coordinates
  const defaultCenter = [12.9716, 77.5946];
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // Count active filters
  const activeFilterCount = [
    filters.connectorType,
    filters.minPower,
    filters.maxPrice,
    filters.amenities.length > 0
  ].filter(Boolean).length;

  // Fetch chargers
  useEffect(() => {
    const fetchChargers = async () => {
      try {
        setLoading(true);
        const params = {};
        if (filters.connectorType) params.connector = filters.connectorType;
        if (filters.minPower) params.minKw = filters.minPower;
        if (filters.maxPrice) params.maxPrice = filters.maxPrice;
        
        const response = await chargerService.searchChargers(params);
        setChargers(response.data || []);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load chargers');
        setChargers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChargers();
  }, [filters.connectorType, filters.minPower, filters.maxPrice]);

  // Filter chargers by amenities (client-side)
  const filteredChargers = useMemo(() => {
    if (filters.amenities.length === 0) return chargers;
    return chargers.filter(charger => {
      const chargerAmenities = Array.isArray(charger.amenities) 
        ? charger.amenities 
        : [];
      return filters.amenities.every(amenity => 
        chargerAmenities.some(a => a.toLowerCase().includes(amenity.toLowerCase()))
      );
    });
  }, [chargers, filters.amenities]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (value && (typeof value !== 'object' || value.length > 0)) {
      newParams.set(key, Array.isArray(value) ? value.join(',') : value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const toggleAmenity = (amenity) => {
    const newAmenities = filters.amenities.includes(amenity)
      ? filters.amenities.filter(a => a !== amenity)
      : [...filters.amenities, amenity];
    handleFilterChange('amenities', newAmenities);
  };

  const handleChargerClick = (charger) => {
    setSelectedCharger(charger);
    setMapCenter([charger.latitude, charger.longitude]);
  };

  const clearAllFilters = () => {
    setFilters({ connectorType: '', minPower: '', maxPrice: '', amenities: [] });
    setSearchParams({});
  };

  const connectorTypes = ['Type2', 'CCS2', 'CHAdeMO', 'Type1', 'GBT'];
  const amenityOptions = ['wifi', 'restroom', 'cafe', 'parking', 'security', 'seating'];

  // Get display values from charger (handle backend field names)
  const getChargerDisplay = (charger) => ({
    id: charger.id,
    name: charger.name || charger.title || 'Unnamed Charger',
    address: charger.address,
    latitude: charger.latitude,
    longitude: charger.longitude,
    connectorType: charger.connectorType,
    powerKw: kwTierToNumber[charger.kwTier] || charger.powerKw || 7.4,
    lowestPrice: charger.lowestPrice || charger.pricePerHour || 0,
    rating: charger.avgRating || charger.rating || 0,
    totalBookings: charger.totalBookings || 0,
    amenities: Array.isArray(charger.amenities) ? charger.amenities : [],
    photos: charger.photos || charger.images || [],
    host: charger.host,
    packages: charger.packages || [],
    distanceKm: charger.distanceKm,
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search Header */}
            <div className="flex items-center gap-2 mr-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Find Chargers</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {filteredChargers.length} available
                </p>
              </div>
            </div>

            {/* Connector Type */}
            <div className="flex-shrink-0 w-40">
              <Select
                value={filters.connectorType}
                onChange={(value) => handleFilterChange('connectorType', value)}
                placeholder="Connector"
                options={[
                  { value: '', label: 'All Connectors' },
                  ...connectorTypes.map(type => ({ value: type, label: type }))
                ]}
                size="sm"
              />
            </div>

            {/* Min Power */}
            <div className="flex items-center gap-2">
              <NumberFilter
                label="Minimum power"
                placeholder="Min"
                unit="kW"
                max={350}
                step={0.1}
                value={filters.minPower}
                onChange={(v) => handleFilterChange('minPower', v)}
              />
              <div className="hidden md:flex gap-1">
                {POWER_PRESETS.map(kw => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => handleFilterChange('minPower', String(filters.minPower) === String(kw) ? '' : String(kw))}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      String(filters.minPower) === String(kw)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {kw}+
                  </button>
                ))}
              </div>
            </div>

            {/* Max Price */}
            <NumberFilter
              label="Maximum price per hour"
              placeholder="Max"
              unit="$/hr"
              max={10000}
              value={filters.maxPrice}
              onChange={(v) => handleFilterChange('maxPrice', v)}
            />

            {/* Amenities Toggle */}
            <div className="hidden lg:flex flex-wrap gap-2">
              {amenityOptions.map(amenity => {
                const Icon = AMENITY_ICONS[amenity];
                return (
                  <button
                    key={amenity}
                    onClick={() => toggleAmenity(amenity)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                      filters.amenities.includes(amenity)
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    {amenity}
                  </button>
                );
              })}
            </div>

            {/* Mobile Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>

          {/* Mobile Amenities */}
          {showFilters && (
            <div className="lg:hidden mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {amenityOptions.map(amenity => {
                  const Icon = AMENITY_ICONS[amenity];
                  return (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                        filters.amenities.includes(amenity)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {Icon && <Icon className="w-3 h-3" />}
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-8rem)]">
        {/* Charger List */}
        <div className="w-full lg:w-1/2 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loading size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          ) : filteredChargers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Battery className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No chargers found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Try adjusting your filters or search in a different area.</p>
              {activeFilterCount > 0 && (
                <Button variant="outline" onClick={clearAllFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {filteredChargers.length} charger{filteredChargers.length !== 1 ? 's' : ''} found in Bengaluru
              </p>
              <div className="space-y-4">
                {filteredChargers.map(rawCharger => {
                  const charger = getChargerDisplay(rawCharger);
                  return (
                    <Card
                      key={charger.id}
                      className={`cursor-pointer transition-all hover:shadow-lg dark:bg-gray-800 overflow-hidden group ${
                        selectedCharger?.id === charger.id ? 'ring-2 ring-green-500' : ''
                      }`}
                      onClick={() => handleChargerClick(charger)}
                    >
                      <div className="flex gap-4 p-4">
                        {/* Image Carousel */}
                        <div className="flex-shrink-0 w-32 h-28 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700">
                          {charger.photos?.length > 0 ? (
                            <ImageCarousel
                              images={charger.photos}
                              alt={charger.name}
                              aspectRatio="4/3"
                              showArrows={charger.photos?.length > 1}
                              showDots={false}
                              showThumbnails={false}
                              className="h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Battery className="w-10 h-10 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{charger.name}</h3>
                            <Badge variant="success" className="flex-shrink-0">{charger.connectorType}</Badge>
                          </div>
                          
                          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{charger.address}</span>
                          </div>
                          
                          <div className="flex items-center gap-4 mb-2">
                            <span className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-white">
                              <Zap className="w-4 h-4 text-yellow-500" />
                              {charger.powerKw} kW
                            </span>
                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                              {charger.lowestPrice > 0 ? `$${charger.lowestPrice}` : 'Free'}
                              {charger.packages?.[0] && <span className="text-gray-500 dark:text-gray-400 font-normal"> / {charger.packages[0].durationMin}min</span>}
                            </span>
                            {charger.rating > 0 && (
                              <div className="flex items-center gap-1">
                                <StarRating rating={charger.rating} size="sm" readonly />
                                <span className="text-xs text-gray-500 dark:text-gray-400">({charger.totalBookings})</span>
                              </div>
                            )}
                          </div>

                          {/* Amenities */}
                          {charger.amenities?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {charger.amenities.slice(0, 4).map((amenity, idx) => {
                                const Icon = AMENITY_ICONS[amenity.toLowerCase()];
                                return (
                                  <span
                                    key={idx}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full capitalize"
                                  >
                                    {Icon && <Icon className="w-3 h-3" />}
                                    {amenity}
                                  </span>
                                );
                              })}
                              {charger.amenities.length > 4 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 px-1">
                                  +{charger.amenities.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Book Button */}
                        <div className="flex-shrink-0 flex items-center">
                          <Button
                            size="sm"
                            className="group-hover:bg-green-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/chargers/${charger.id}`);
                            }}
                          >
                            View
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Map */}
        <div className="hidden lg:block lg:w-1/2 sticky top-32 h-[calc(100vh-8rem)]">
          <MapContainer
            center={mapCenter}
            zoom={12}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapRecenter center={mapCenter} />
            
            {filteredChargers.map(rawCharger => {
              const charger = getChargerDisplay(rawCharger);
              return (
                <Marker
                  key={charger.id}
                  position={[charger.latitude, charger.longitude]}
                  icon={chargerIcon}
                  eventHandlers={{
                    click: () => handleChargerClick(charger),
                  }}
                >
                  <Popup>
                    <div className="p-2 min-w-[220px]">
                      <h3 className="font-semibold text-gray-900">{charger.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{charger.address}</p>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="flex items-center gap-1 font-medium text-gray-900">
                          <Zap className="w-4 h-4 text-yellow-500" />
                          {charger.powerKw} kW
                        </span>
                        <span className="text-green-600 font-medium">${charger.lowestPrice}</span>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => navigate(`/chargers/${charger.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
