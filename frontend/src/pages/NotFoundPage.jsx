import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl mb-4">🔌</div>
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Oops! Looks like you took a wrong turn
        </h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on the road!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button size="lg">
              Back to Home
            </Button>
          </Link>
          <Link to="/search">
            <Button size="lg" variant="outline">
              Find Chargers
            </Button>
          </Link>
        </div>
        
        <div className="mt-12 text-sm text-gray-500">
          <p>Need help? <Link to="/chat" className="text-green-600 hover:underline">Chat with our AI Concierge</Link></p>
        </div>
      </div>
    </div>
  );
}
