import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const TEAM_MEMBERS = [
  {
    name: 'Nandini A Choukimath',
    role: 'Co-Founder & CEO',
    bio: 'Passionate about sustainable transportation and clean energy solutions. Leading the vision of making EV charging accessible to everyone through peer-to-peer sharing.',
    image: null,
    linkedin: '#',
    github: '#',
  },
  {
    name: 'Shaleen Shukla',
    role: 'Co-Founder & CTO',
    bio: 'Full-stack developer with expertise in building scalable platforms. Architecting the technical foundation for seamless EV charging experiences.',
    image: null,
    linkedin: '#',
    github: '#',
  },
];

const MILESTONES = [
  { date: 'Nov 2026', event: 'PayPal AI Hackathon Submission' },
  { date: 'Q1 2027', event: 'Beta Launch in Bengaluru' },
  { date: 'Q2 2027', event: 'Expansion to Tier-1 Cities' },
  { date: 'Q3 2027', event: 'Mobile App Launch' },
  { date: 'Q4 2027', event: 'Pan-India Operations' },
];

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-600 to-emerald-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Meet the Team
          </h1>
          <p className="text-xl text-green-100 max-w-2xl mx-auto">
            We're building the future of peer-to-peer EV charging in India,
            one home charger at a time.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Mission</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              To accelerate India's transition to electric vehicles by making charging
              infrastructure accessible, affordable, and available everywhere through
              the power of community sharing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🌱</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Sustainable</h3>
              <p className="text-gray-600 text-sm">
                Maximizing existing infrastructure reduces the need for new construction
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🤝</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Community-Driven</h3>
              <p className="text-gray-600 text-sm">
                Neighbors helping neighbors, building stronger EV communities
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🤖</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">AI-Powered</h3>
              <p className="text-gray-600 text-sm">
                Smart assistance with transparent, safe autonomous operations
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Members */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            The Founders
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {TEAM_MEMBERS.map((member, index) => (
              <Card key={index} className="text-center p-8">
                <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl text-white font-bold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900">{member.name}</h3>
                <p className="text-green-600 font-medium mb-3">{member.role}</p>
                <p className="text-gray-600 text-sm mb-4">{member.bio}</p>
                <div className="flex justify-center gap-3">
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-600"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                  </a>
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-900"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Our Journey
          </h2>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-green-200" />
            
            <div className="space-y-8">
              {MILESTONES.map((milestone, index) => (
                <div
                  key={index}
                  className={`flex items-center ${
                    index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'
                  }`}
                >
                  <div className={`w-5/12 ${index % 2 === 0 ? 'text-right pr-8' : 'text-left pl-8'}`}>
                    <div className="text-sm font-medium text-green-600">{milestone.date}</div>
                    <div className="font-semibold text-gray-900">{milestone.event}</div>
                  </div>
                  <div className="w-2/12 flex justify-center">
                    <div className={`w-4 h-4 rounded-full border-4 border-white shadow ${
                      index === 0 ? 'bg-green-600' : 'bg-green-300'
                    }`} />
                  </div>
                  <div className="w-5/12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-green-600 to-emerald-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Join Our Mission
          </h2>
          <p className="text-lg text-green-100 mb-8 max-w-2xl mx-auto">
            Whether you're an EV driver looking for convenient charging or a homeowner
            with a charger to share, be part of India's EV revolution.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="bg-white text-green-600 hover:bg-green-50">
                Get Started
              </Button>
            </Link>
            <Link to="/search">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Find Chargers
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Hackathon Badge */}
      <section className="py-8 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-400 mb-2">Built for</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl">🏆</span>
            <span className="text-xl font-semibold">PayPal AI Hackathon 2026</span>
            <span className="text-2xl">🏆</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Showcasing AI-powered payments and autonomous agent capabilities
          </p>
        </div>
      </section>
    </div>
  );
}
