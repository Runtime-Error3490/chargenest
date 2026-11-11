/**
 * Skeleton Loading Components
 * 
 * Purpose: Provides visual placeholders while content is loading, improving perceived performance
 * and user experience by showing the layout structure before data arrives.
 * 
 * Benefits of Skeleton Loading:
 * 1. Reduces perceived loading time - users see immediate visual feedback
 * 2. Prevents layout shift - content doesn't jump around when loaded
 * 3. Better UX than spinners - shows the structure of upcoming content
 * 4. Reduces bounce rate - users are more likely to wait when they see progress
 */

// Base skeleton with shimmer animation
export function Skeleton({ className = '', variant = 'rectangular' }) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';
  
  const variantClasses = {
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded h-4',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
}

// Page-level skeleton for dashboard/list pages
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header skeleton */}
      <div className="bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-700 dark:to-gray-800 h-40 animate-pulse" />
      
      <div className="max-w-7xl mx-auto px-4 -mt-6 pb-8">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton variant="rectangular" className="w-12 h-12 rounded-xl" />
              </div>
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="space-y-6">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={3} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Card skeleton
export function CardSkeleton({ lines = 5 }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="rectangular" className="w-10 h-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

// List item skeleton
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
      <Skeleton variant="rectangular" className="w-14 h-14 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  );
}

// Search/charger list skeleton
export function ChargerListSkeleton({ count = 6 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-lg">
          <div className="flex gap-4">
            <Skeleton variant="rectangular" className="w-32 h-32 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Booking detail skeleton
export function BookingDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back button */}
        <Skeleton className="h-6 w-32 mb-6" />
        
        {/* Header card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6 overflow-hidden">
          <Skeleton className="h-2 w-full" />
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex gap-3">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-8 w-48" />
              </div>
              <div className="text-right space-y-2">
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-8 w-24 ml-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CardSkeleton lines={6} />
            <CardSkeleton lines={4} />
          </div>
          <div>
            <CardSkeleton lines={8} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Chat skeleton
export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" className="w-10 h-10" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 p-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md space-y-2 ${i % 2 === 0 ? 'items-end' : 'items-start'}`}>
              <Skeleton className={`h-20 ${i % 2 === 0 ? 'w-64' : 'w-80'} rounded-2xl`} />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Input */}
      <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

// Full page loading fallback with branding
export function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg shadow-green-500/25">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-32 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto animate-pulse" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading ChargeNest...</p>
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
