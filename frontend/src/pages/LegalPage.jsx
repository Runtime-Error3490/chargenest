import { Link } from 'react-router-dom';
import { Shield, FileText, Home, ChevronRight } from 'lucide-react';

// Single source of legal text. Register modals and footer/host links all use these pages.
// Each section body is a string or a list of strings (rendered as bullets).
export const LEGAL_DOCUMENTS = {
  terms: {
    title: 'Terms of Service',
    icon: FileText,
    color: 'primary',
    description: 'The rules and guidelines for using ChargeNest',
    sections: [
      ['1. Acceptance of Terms', 'By creating an account and using the ChargeNest marketplace, you agree to these Terms of Service. If you do not agree, please do not use our services.'],
      ['2. Service Description', 'ChargeNest is a peer-to-peer marketplace connecting EV drivers with home charger hosts. We facilitate bookings and payments but do not own or operate the charging equipment.'],
      ['3. User Responsibilities', [
        'Drivers: provide accurate vehicle information, arrive on time for bookings, and use charging equipment responsibly.',
        'Hosts: keep your charger properly maintained, accurately described, and available during listed times.',
      ]],
      ['4. Payments and Fees', 'All payments are processed through PayPal. A platform fee of 7% is charged on each booking. Hosts receive payouts after a session is completed.'],
      ['5. Cancellation Policy', [
        'More than 24 hours before start: full refund.',
        '12 to 24 hours before start: 25% fee.',
        '6 to 12 hours before start: 50% fee.',
        'Less than 6 hours before start, or no-show: 100% fee.',
      ]],
      ['6. Reviews', 'Only people who completed a booking can review it. Drivers review the charger, and hosts review the driver. Each side can leave one review per booking.'],
      ['7. Disputes', 'Disputes are reviewed by our AI system and, if needed, escalated to an admin. Both parties must provide evidence to support their claims.'],
      ['8. Data Collection and Audit', 'We log user activity for security, compliance, and dispute resolution. This includes login attempts, bookings, and payments. See our Privacy Policy.'],
      ['9. Limitation of Liability', 'ChargeNest is not liable for damage to vehicles or property during charging sessions. Users engage in transactions at their own risk.'],
      ['10. Modifications', 'We may modify these terms at any time. Continued use of the service means you accept the updated terms.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    icon: Shield,
    color: 'blue',
    description: 'How we collect, use, and protect your data',
    sections: [
      ['1. Information We Collect', 'We collect the personal information you provide at registration (name, email, phone), plus usage data and transaction history.'],
      ['2. How We Use Your Information', [
        'To provide and improve our services',
        'To process payments and payouts',
        'To communicate with you about bookings',
        'For security and fraud prevention',
        'To comply with legal obligations',
      ]],
      ['3. Audit Logging', [
        'Login attempts and authentication events',
        'Booking creation, changes, and cancellations',
        'Payment authorizations and transactions',
        'Dispute submissions and resolutions',
        'IP addresses and device information',
      ]],
      ['4. Data Sharing', [
        'PayPal, for payment processing',
        'Other users, as needed for bookings (for example, a host sees the driver name)',
        'Law enforcement, when legally required',
      ]],
      ['5. Data Retention', 'Audit logs are kept for 7 years for legal compliance. Account data is kept for the life of your account plus 3 years.'],
      ['6. Your Rights (GDPR/DPDP)', [
        'Access your personal data',
        'Request correction of inaccurate data',
        'Request deletion (subject to legal retention requirements)',
        'Export your data in a portable format',
      ]],
      ['7. Security', 'We use encryption, secure authentication, and access controls to protect your data. MFA is strongly encouraged for all accounts.'],
      ['8. Contact', 'For privacy questions: privacy@chargenest.com'],
    ],
  },
  'host-policy': {
    title: 'Host Policy',
    icon: Home,
    color: 'accent',
    description: 'Guidelines and responsibilities for ChargeNest hosts',
    sections: [
      ['Your charger', 'List only chargers you own or have permission to share. Describe the connector, power and location honestly, and keep your listing up to date.'],
      ['Photos', 'Upload up to 5 clear, recent photos of your own charger and its location. Do not upload photos of people or images you do not own.'],
      ['Safety', 'Keep your charger in safe working condition and follow local electrical rules. Remove your listing if it becomes unsafe.'],
      ['Availability and access', 'Honour confirmed bookings and share clear access instructions with drivers.'],
      ['Reviewing drivers', 'After a completed booking you can rate the driver once. Keep reviews honest and about the booking.'],
      ['Earnings', 'You receive the booking amount minus the 7% platform fee. Payouts are made through PayPal after a session is completed.'],
      ['Liability', 'ChargeNest does not provide insurance coverage for your equipment. You are responsible for maintaining your own homeowner\'s or renter\'s insurance. ChargeNest is not liable for any damage to your charger or property during sessions.'],
    ],
  },
};

const colorClasses = {
  primary: {
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    border: 'border-primary-200 dark:border-primary-800',
    icon: 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400',
    heading: 'text-primary-700 dark:text-primary-400',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    heading: 'text-blue-700 dark:text-blue-400',
  },
  accent: {
    bg: 'bg-accent-50 dark:bg-accent-900/20',
    border: 'border-accent-200 dark:border-accent-800',
    icon: 'bg-accent-100 dark:bg-accent-900/50 text-accent-600 dark:text-accent-400',
    heading: 'text-accent-700 dark:text-accent-400',
  },
};

// Renders a document's sections; shared by the full page and the Register modals
export function LegalSections({ doc }) {
  const document = LEGAL_DOCUMENTS[doc];
  const colors = colorClasses[document.color];
  
  return (
    <div className="space-y-8">
      {document.sections.map(([heading, body], index) => (
        <section key={heading} className="group">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${colors.icon} flex items-center justify-center text-sm font-bold`}>
              {index + 1}
            </div>
            <div className="flex-1">
              <h2 className={`font-semibold text-lg mb-2 ${colors.heading}`}>{heading.replace(/^\d+\.\s*/, '')}</h2>
              {Array.isArray(body) ? (
                <ul className="space-y-2">
                  {body.map(item => (
                    <li key={item} className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                      <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0 text-gray-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{body}</p>
              )}
            </div>
          </div>
        </section>
      ))}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: November 2026 · Version 1.0
        </p>
      </div>
    </div>
  );
}

export default function LegalPage({ doc }) {
  const document = LEGAL_DOCUMENTS[doc];
  const colors = colorClasses[document.color];
  const Icon = document.icon;
  const others = Object.entries(LEGAL_DOCUMENTS).filter(([key]) => key !== doc);
  const paths = { terms: '/terms', privacy: '/privacy', 'host-policy': '/host-policy' };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Breadcrumb */}
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-8">
          <span>←</span>
          <span>Back to home</span>
        </Link>
        
        {/* Header */}
        <div className={`rounded-2xl ${colors.bg} border ${colors.border} p-8 mb-8`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-14 h-14 rounded-xl ${colors.icon} flex items-center justify-center`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{document.title}</h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">{document.description}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 md:p-10">
          <LegalSections doc={doc} />
        </div>

        {/* Other Documents */}
        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Other Legal Documents</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {others.map(([key, d]) => {
              const OtherIcon = d.icon;
              const otherColors = colorClasses[d.color];
              return (
                <Link 
                  key={key} 
                  to={paths[key]} 
                  className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                >
                  <div className={`w-10 h-10 rounded-lg ${otherColors.icon} flex items-center justify-center`}>
                    <OtherIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{d.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{d.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
