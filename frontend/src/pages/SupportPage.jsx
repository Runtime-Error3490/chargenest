import { Link } from 'react-router-dom';
import { Mail, Clock, MessageCircle, Shield, FileText } from 'lucide-react';
import Card from '../components/ui/Card';

// Placeholder contact details. Replace with the real support address and hours before launch.
export const SUPPORT_EMAIL = 'support@chargenest.example.com';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Support</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Our AI Concierge can fix most things quickly. If it can't, email us and a person will help.
          </p>
        </div>

        <Card className="p-6 bg-white dark:bg-gray-800">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white">Email us</h2>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-lg font-medium text-green-600 dark:text-green-400 hover:underline break-all"
              >
                {SUPPORT_EMAIL}
              </a>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This is a demo address for now. Messages sent to it are not read.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white dark:bg-gray-800">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">When we reply</h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Monday to Friday, 9 AM to 6 PM IST. We aim to answer within one working day.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white dark:bg-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Help us help you faster</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">Please include:</p>
          <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-300">
            <li>The email address of your ChargeNest account.</li>
            <li>The booking number, if it is about a booking (shown as #ABC12345 on the booking page).</li>
            <li>What you expected, what happened instead, and a screenshot if you can.</li>
          </ul>
        </Card>

        <div className="grid sm:grid-cols-3 gap-3">
          <Link to="/chat" className="flex items-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-green-400">
            <MessageCircle className="w-4 h-4" /> Ask AI Concierge
          </Link>
          <Link to="/terms" className="flex items-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-green-400">
            <FileText className="w-4 h-4" /> Terms of Service
          </Link>
          <Link to="/privacy" className="flex items-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-green-400">
            <Shield className="w-4 h-4" /> Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
