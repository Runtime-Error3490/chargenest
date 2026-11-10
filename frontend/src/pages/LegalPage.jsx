import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';

// Single source of legal text. Register modals and footer/host links all use these pages.
// Each section body is a string or a list of strings (rendered as bullets).
export const LEGAL_DOCUMENTS = {
  terms: {
    title: 'Terms of Service',
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
      ['8. Contact', 'For privacy questions: privacy@evcharge.com'],
    ],
  },
  'host-policy': {
    title: 'Host Policy',
    sections: [
      ['Your charger', 'List only chargers you own or have permission to share. Describe the connector, power and location honestly, and keep your listing up to date.'],
      ['Photos', 'Upload up to 5 clear, recent photos of your own charger and its location. Do not upload photos of people or images you do not own.'],
      ['Safety', 'Keep your charger in safe working condition and follow local electrical rules. Remove your listing if it becomes unsafe.'],
      ['Availability and access', 'Honour confirmed bookings and share clear access instructions with drivers.'],
      ['Reviewing drivers', 'After a completed booking you can rate the driver once. Keep reviews honest and about the booking.'],
      ['Earnings', 'You receive the booking amount minus the 7% platform fee. Payouts are made through PayPal after a session is completed.'],
    ],
  },
};

// Renders a document's sections; shared by the full page and the Register modals
export function LegalSections({ doc }) {
  return (
    <div className="space-y-6">
      {LEGAL_DOCUMENTS[doc].sections.map(([heading, body]) => (
        <section key={heading}>
          <h2 className="font-semibold text-gray-900 mb-1">{heading}</h2>
          {Array.isArray(body) ? (
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              {body.map(item => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p className="text-gray-600">{body}</p>
          )}
        </section>
      ))}
      <p className="text-xs text-gray-400 pt-4 border-t">
        Last updated: November 2026 · Version 1.0. Demo text: have it reviewed by legal counsel before launch.
      </p>
    </div>
  );
}

export default function LegalPage({ doc }) {
  const others = Object.entries(LEGAL_DOCUMENTS).filter(([key]) => key !== doc);
  const paths = { terms: '/terms', privacy: '/privacy', 'host-policy': '/host-policy' };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">&larr; Back to home</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">{LEGAL_DOCUMENTS[doc].title}</h1>
        <Card className="p-8">
          <LegalSections doc={doc} />
        </Card>
        <p className="text-sm text-gray-500 mt-6">
          See also:{' '}
          {others.map(([key, d], i) => (
            <span key={key}>
              {i > 0 && ' · '}
              <Link to={paths[key]} className="text-green-600 hover:underline">{d.title}</Link>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
