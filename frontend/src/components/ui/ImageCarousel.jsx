import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Generic charger image shown when a listing has no photos (served from /public)
export const PLACEHOLDER_SRC = '/charger-placeholder.svg';

/**
 * Image Carousel component with navigation arrows, dots, and auto-play support
 */
export default function ImageCarousel({
  images = [],
  alt = 'Image',
  aspectRatio = 'video', // 'video' (16:9), 'square', 'wide' (21:9), or custom like '4/3'
  showArrows = true,
  showDots = true,
  showThumbnails = false,
  autoPlay = false,
  autoPlayInterval = 5000,
  className = '',
  fallback = null,
  onImageClick = null,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState({});

  // Reset to first image when images change
  useEffect(() => {
    setCurrentIndex(0);
    setImageLoadErrors({});
  }, [images]);

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || images.length <= 1 || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [autoPlay, autoPlayInterval, images.length, isHovered]);

  const goToPrevious = useCallback((e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goToNext = useCallback((e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToIndex = useCallback((index) => {
    setCurrentIndex(index);
  }, []);

  const handleImageError = useCallback((index) => {
    setImageLoadErrors((prev) => ({ ...prev, [index]: true }));
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      goToPrevious();
    } else if (e.key === 'ArrowRight') {
      goToNext();
    }
  }, [goToPrevious, goToNext]);

  // Get aspect ratio class
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'video':
        return 'aspect-video';
      case 'square':
        return 'aspect-square';
      case 'wide':
        return 'aspect-[21/9]';
      default:
        return `aspect-[${aspectRatio}]`;
    }
  };

  // If no images, show fallback
  if (!images || images.length === 0) {
    return (
      <div className={`relative ${getAspectRatioClass()} bg-gray-200 rounded-lg overflow-hidden ${className}`}>
        {fallback || (
          <img
            src={PLACEHOLDER_SRC}
            alt={`${alt} (no photo available)`}
            className="w-full h-full object-cover"
            draggable={false}
          />
        )}
      </div>
    );
  }

  const currentImage = images[currentIndex];
  const hasError = imageLoadErrors[currentIndex];

  return (
    <div className={`relative ${className}`}>
      {/* Main Image Container */}
      <div
        className={`relative ${getAspectRatioClass()} bg-gray-200 rounded-lg overflow-hidden group`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Image carousel"
        aria-roledescription="carousel"
      >
        {/* Current Image */}
        {hasError ? (
          <img
            src={PLACEHOLDER_SRC}
            alt={`${alt} (photo unavailable)`}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <img
            src={currentImage}
            alt={`${alt} ${currentIndex + 1} of ${images.length}`}
            className="w-full h-full object-cover transition-opacity duration-300 cursor-pointer"
            onClick={() => onImageClick?.(currentIndex)}
            onError={() => handleImageError(currentIndex)}
            draggable={false}
          />
        )}

        {/* Navigation Arrows */}
        {showArrows && images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Dot Indicators */}
        {showDots && images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  goToIndex(index);
                }}
                className={`w-2 h-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 ${
                  index === currentIndex
                    ? 'bg-white w-4'
                    : 'bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`Go to image ${index + 1}`}
                aria-current={index === currentIndex ? 'true' : 'false'}
              />
            ))}
          </div>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail Strip */}
      {showThumbnails && images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all focus:outline-none focus:ring-2 focus:ring-green-500 ${
                index === currentIndex
                  ? 'border-green-500 ring-1 ring-green-500'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
              aria-label={`View image ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : 'false'}
            >
              {imageLoadErrors[index] ? (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-xs">📷</span>
                </div>
              ) : (
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(index)}
                  draggable={false}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
