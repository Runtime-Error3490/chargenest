import { Star } from 'lucide-react';

export function StarRating({ rating, maxRating = 5, size = 'md', showValue = true }) {
  const sizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const stars = [];
  for (let i = 1; i <= maxRating; i++) {
    const filled = i <= Math.round(rating);
    stars.push(
      <Star
        key={i}
        className={`${sizes[size]} ${filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">{stars}</div>
      {showValue && (
        <span className="text-sm text-gray-600 ml-1">
          {rating?.toFixed(1) || '0.0'}
        </span>
      )}
    </div>
  );
}

export function InteractiveStarRating({ value, onChange, size = 'lg' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`${sizes[size]} ${
              star <= value 
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-gray-300 hover:text-yellow-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default StarRating;
