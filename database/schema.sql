-- ============================================
-- EV Home-Charging Marketplace Database Schema
-- PostgreSQL 15+
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "earthdistance" CASCADE;

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('driver', 'host', 'admin');
CREATE TYPE agent_status AS ENUM ('active', 'revoked', 'suspended');
CREATE TYPE mandate_status AS ENUM ('active', 'used', 'expired', 'revoked');
CREATE TYPE connector_type AS ENUM ('Type2', 'CCS2', 'CHAdeMO', 'Type1', 'GBT');
CREATE TYPE kw_tier AS ENUM ('3.3kW', '7.4kW', '11kW', '22kW', '50kW', '150kW');
CREATE TYPE charger_status AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE booking_status AS ENUM (
    'pending',
    'authorized',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
    'disputed'
);
CREATE TYPE session_status AS ENUM (
    'awaiting_start',
    'driver_confirmed',
    'host_confirmed',
    'in_progress',
    'ended',
    'disputed'
);
CREATE TYPE payment_status AS ENUM (
    'pending',
    'authorized',
    'captured',
    'partially_refunded',
    'refunded',
    'voided',
    'failed'
);
CREATE TYPE dispute_status AS ENUM (
    'open',
    'ai_reviewed',
    'pending_admin',
    'resolved',
    'closed'
);
CREATE TYPE dispute_decision AS ENUM (
    'release_to_host',
    'partial_refund',
    'full_refund'
);

-- ============================================
-- TABLES
-- ============================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(500),
    is_verified BOOLEAN DEFAULT FALSE,
    paypal_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- User roles (many-to-many: user can have multiple roles)
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);

-- Agents (AI agents registered per user)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Charging Concierge',
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    version VARCHAR(50),
    status agent_status DEFAULT 'active',
    public_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agents_user ON agents(user_id);

-- Mandates (spending authorizations for agents)
CREATE TABLE mandates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    max_distance_km DECIMAL(5, 2),
    connector_types connector_type[],
    token TEXT NOT NULL,
    status mandate_status DEFAULT 'active',
    amount_used DECIMAL(10, 2) DEFAULT 0,
    bookings_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_mandates_agent ON mandates(agent_id);
CREATE INDEX idx_mandates_user ON mandates(user_id);
CREATE INDEX idx_mandates_status ON mandates(status);

-- Chargers (host listings)
CREATE TABLE chargers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Bengaluru',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    connector_type connector_type NOT NULL,
    kw_tier kw_tier NOT NULL,
    amenities JSONB DEFAULT '[]',
    photos VARCHAR(500)[],
    status charger_status DEFAULT 'active',
    total_bookings INTEGER DEFAULT 0,
    avg_rating DECIMAL(2, 1) DEFAULT 0,
    suggested_price DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chargers_host ON chargers(host_id);
CREATE INDEX idx_chargers_status ON chargers(status);
CREATE INDEX idx_chargers_connector ON chargers(connector_type);
CREATE INDEX idx_chargers_location ON chargers USING GIST (
    ll_to_earth(latitude, longitude)
);

-- Time packages (pricing tiers per charger)
CREATE TABLE time_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    charger_id UUID NOT NULL REFERENCES chargers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    duration_min INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_packages_charger ON time_packages(charger_id);

-- Availability (weekly schedule per charger)
CREATE TABLE availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    charger_id UUID NOT NULL REFERENCES chargers(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX idx_availability_charger ON availability(charger_id);

-- Bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    charger_id UUID NOT NULL REFERENCES chargers(id),
    driver_id UUID NOT NULL REFERENCES users(id),
    package_id UUID NOT NULL REFERENCES time_packages(id),
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    base_amount DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    mandate_id UUID REFERENCES mandates(id),
    booked_by_agent BOOLEAN DEFAULT FALSE,
    status booking_status DEFAULT 'pending',
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_fee DECIMAL(10, 2),
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_charger ON bookings(charger_id);
CREATE INDEX idx_bookings_driver ON bookings(driver_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_scheduled ON bookings(scheduled_start);

-- Sessions (actual charging sessions)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    driver_start_confirm TIMESTAMP WITH TIME ZONE,
    host_start_confirm TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    actual_duration_min INTEGER,
    driver_end_confirm TIMESTAMP WITH TIME ZONE,
    host_end_confirm TIMESTAMP WITH TIME ZONE,
    final_amount DECIMAL(10, 2),
    status session_status DEFAULT 'awaiting_start',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_booking ON sessions(booking_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    paypal_order_id VARCHAR(100),
    paypal_auth_id VARCHAR(100),
    paypal_capture_id VARCHAR(100),
    paypal_payout_id VARCHAR(100),
    authorized_amount DECIMAL(10, 2),
    captured_amount DECIMAL(10, 2),
    refunded_amount DECIMAL(10, 2) DEFAULT 0,
    host_payout_amount DECIMAL(10, 2),
    platform_fee_amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'INR',
    status payment_status DEFAULT 'pending',
    mandate_id UUID REFERENCES mandates(id),
    authorized_at TIMESTAMP WITH TIME ZONE,
    captured_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    payout_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_paypal_order ON payments(paypal_order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Disputes
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    raised_by_id UUID NOT NULL REFERENCES users(id),
    raised_by_role user_role NOT NULL,
    reason VARCHAR(500) NOT NULL,
    description TEXT,
    evidence JSONB,
    ai_decision dispute_decision,
    ai_refund_amount DECIMAL(10, 2),
    ai_reasoning TEXT,
    ai_confidence DECIMAL(3, 2),
    ai_reviewed_at TIMESTAMP WITH TIME ZONE,
    final_decision dispute_decision,
    final_refund_amount DECIMAL(10, 2),
    admin_notes TEXT,
    resolved_by_id UUID REFERENCES users(id),
    status dispute_status DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_disputes_booking ON disputes(booking_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- Audit log (for agent actions)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id),
    mandate_id UUID REFERENCES mandates(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    inputs JSONB,
    outputs JSONB,
    booking_id UUID REFERENCES bookings(id),
    paypal_order_id VARCHAR(100),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_agent ON audit_log(agent_id);
CREATE INDEX idx_audit_mandate ON audit_log(mandate_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Driver ratings (driver rates charger)
CREATE TABLE driver_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) UNIQUE,
    charger_id UUID NOT NULL REFERENCES chargers(id),
    driver_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_ratings_charger ON driver_ratings(charger_id);

-- Host ratings (host rates driver)
CREATE TABLE host_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) UNIQUE,
    driver_id UUID NOT NULL REFERENCES users(id),
    host_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_host_ratings_driver ON host_ratings(driver_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chargers_updated_at BEFORE UPDATE ON chargers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate distance between coordinates
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DECIMAL, lon1 DECIMAL,
    lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    RETURN (earth_distance(
        ll_to_earth(lat1, lon1),
        ll_to_earth(lat2, lon2)
    ) / 1000.0)::DECIMAL(10, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update charger avg rating
CREATE OR REPLACE FUNCTION update_charger_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chargers
    SET avg_rating = (
        SELECT COALESCE(AVG(rating)::DECIMAL(2,1), 0)
        FROM driver_ratings
        WHERE charger_id = NEW.charger_id
    )
    WHERE id = NEW.charger_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_charger_rating_trigger
AFTER INSERT OR UPDATE ON driver_ratings
FOR EACH ROW EXECUTE FUNCTION update_charger_rating();

-- ============================================
-- SEED DATA
-- ============================================

-- Demo users (passwords are bcrypt hash of 'REDACTED_PASSWORD')
-- In production, generate proper hashes
INSERT INTO users (id, email, password_hash, name, phone, totp_enabled, paypal_email) VALUES
('d1000000-0000-0000-0000-000000000001', 'driver@demo.com', 
 '$2b$10$rQZ8kHqLhqNx5m5q5m5q5uO5q5m5q5m5q5m5q5m5q5m5q5m5q5m5', 
 'Rahul Kumar', '+919876543210', FALSE, 'sb-buyer@personal.example.com'),
('h1000000-0000-0000-0000-000000000001', 'demo_host@example.com', 
 '$2b$10$rQZ8kHqLhqNx5m5q5m5q5uO5q5m5q5m5q5m5q5m5q5m5q5m5q5m5', 
 'Priya Sharma', '+919876543211', FALSE, 'sb-seller@business.example.com'),
('a1000000-0000-0000-0000-000000000001', 'demo_admin@example.com', 
 '$2b$10$rQZ8kHqLhqNx5m5q5m5q5uO5q5m5q5m5q5m5q5m5q5m5q5m5q5m5', 
 'Admin User', '+919876543212', FALSE, 'demo_admin@example.com');

-- Assign roles
INSERT INTO user_roles (user_id, role) VALUES
('d1000000-0000-0000-0000-000000000001', 'driver'),
('h1000000-0000-0000-0000-000000000001', 'host'),
('a1000000-0000-0000-0000-000000000001', 'admin');

-- Demo chargers in Bengaluru
INSERT INTO chargers (id, host_id, name, description, address, city, latitude, longitude, connector_type, kw_tier, amenities, status, suggested_price) VALUES
('c1000000-0000-0000-0000-000000000001', 'h1000000-0000-0000-0000-000000000001',
 'Priya''s Home Charger', 'Well-maintained 7.4kW AC charger in covered parking. Pet-friendly!',
 '123 4th Cross, HSR Layout Sector 2, Bengaluru 560102', 'Bengaluru',
 12.9141, 77.6411, 'Type2', '7.4kW', '["parking", "wifi", "restroom"]', 'active', 140),

('c1000000-0000-0000-0000-000000000002', 'h1000000-0000-0000-0000-000000000001',
 'Quick Charge Koramangala', 'Fast 22kW charger at a cafe. Enjoy coffee while you charge!',
 '45 5th Block, Koramangala, Bengaluru 560095', 'Bengaluru',
 12.9352, 77.6245, 'CCS2', '22kW', '["cafe", "wifi", "seating"]', 'active', 280),

('c1000000-0000-0000-0000-000000000003', 'h1000000-0000-0000-0000-000000000001',
 'Indiranagar Apartment Charger', 'Shared charger in apartment complex. Visitor parking available.',
 '78 100 Feet Road, Indiranagar, Bengaluru 560038', 'Bengaluru',
 12.9784, 77.6408, 'Type2', '11kW', '["parking", "security"]', 'active', 180),

('c1000000-0000-0000-0000-000000000004', 'h1000000-0000-0000-0000-000000000001',
 'Whitefield Tech Park', 'Business charger in tech park. Entry after 6 PM and weekends.',
 '15 ITPL Main Road, Whitefield, Bengaluru 560066', 'Bengaluru',
 12.9698, 77.7500, 'CCS2', '50kW', '["parking", "security", "food_court"]', 'active', 400),

('c1000000-0000-0000-0000-000000000005', 'h1000000-0000-0000-0000-000000000001',
 'JP Nagar Home Charger', 'Quiet residential area. Perfect for overnight charging.',
 '234 15th Cross, JP Nagar 6th Phase, Bengaluru 560078', 'Bengaluru',
 12.8891, 77.5852, 'Type2', '3.3kW', '["parking", "quiet"]', 'active', 80);

-- Time packages for each charger
-- HSR Layout (7.4kW)
INSERT INTO time_packages (charger_id, name, duration_min, price) VALUES
('c1000000-0000-0000-0000-000000000001', 'Quick Charge', 30, 75),
('c1000000-0000-0000-0000-000000000001', 'Standard', 60, 140),
('c1000000-0000-0000-0000-000000000001', 'Extended', 120, 260);

-- Koramangala (22kW - faster = more expensive)
INSERT INTO time_packages (charger_id, name, duration_min, price) VALUES
('c1000000-0000-0000-0000-000000000002', 'Quick Boost', 30, 150),
('c1000000-0000-0000-0000-000000000002', 'Standard', 60, 280),
('c1000000-0000-0000-0000-000000000002', 'Extended', 120, 520);

-- Indiranagar (11kW)
INSERT INTO time_packages (charger_id, name, duration_min, price) VALUES
('c1000000-0000-0000-0000-000000000003', 'Quick Charge', 30, 95),
('c1000000-0000-0000-0000-000000000003', 'Standard', 60, 180),
('c1000000-0000-0000-0000-000000000003', 'Extended', 120, 340);

-- Whitefield (50kW - DC fast)
INSERT INTO time_packages (charger_id, name, duration_min, price) VALUES
('c1000000-0000-0000-0000-000000000004', 'Quick Boost', 30, 220),
('c1000000-0000-0000-0000-000000000004', 'Standard', 60, 400),
('c1000000-0000-0000-0000-000000000004', 'Full Charge', 90, 560);

-- JP Nagar (3.3kW - slow, overnight)
INSERT INTO time_packages (charger_id, name, duration_min, price) VALUES
('c1000000-0000-0000-0000-000000000005', 'Short', 60, 80),
('c1000000-0000-0000-0000-000000000005', 'Half Day', 240, 280),
('c1000000-0000-0000-0000-000000000005', 'Overnight', 480, 500);

-- Availability (Mon-Sun, typical hours)
INSERT INTO availability (charger_id, day_of_week, start_time, end_time) VALUES
-- HSR Layout (Mon-Sun 8am-10pm)
('c1000000-0000-0000-0000-000000000001', 0, '08:00', '22:00'),
('c1000000-0000-0000-0000-000000000001', 1, '08:00', '22:00'),
('c1000000-0000-0000-0000-000000000001', 2, '08:00', '22:00'),
('c1000000-0000-0000-0000-000000000001', 3, '08:00', '22:00'),
('c1000000-0000-0000-0000-000000000001', 4, '08:00', '22:00'),
('c1000000-0000-0000-0000-000000000001', 5, '08:00', '22:00'),
('c1000000-0000-0000-0000-000000000001', 6, '08:00', '22:00'),

-- Koramangala Cafe (Mon-Sun 7am-11pm)
('c1000000-0000-0000-0000-000000000002', 0, '07:00', '23:00'),
('c1000000-0000-0000-0000-000000000002', 1, '07:00', '23:00'),
('c1000000-0000-0000-0000-000000000002', 2, '07:00', '23:00'),
('c1000000-0000-0000-0000-000000000002', 3, '07:00', '23:00'),
('c1000000-0000-0000-0000-000000000002', 4, '07:00', '23:00'),
('c1000000-0000-0000-0000-000000000002', 5, '07:00', '23:00'),
('c1000000-0000-0000-0000-000000000002', 6, '07:00', '23:00'),

-- JP Nagar overnight (6pm-8am next day, represented as two slots)
('c1000000-0000-0000-0000-000000000005', 0, '18:00', '23:59'),
('c1000000-0000-0000-0000-000000000005', 1, '18:00', '23:59'),
('c1000000-0000-0000-0000-000000000005', 2, '18:00', '23:59'),
('c1000000-0000-0000-0000-000000000005', 3, '18:00', '23:59'),
('c1000000-0000-0000-0000-000000000005', 4, '18:00', '23:59'),
('c1000000-0000-0000-0000-000000000005', 5, '18:00', '23:59'),
('c1000000-0000-0000-0000-000000000005', 6, '18:00', '23:59');

-- Default agent for demo driver
INSERT INTO agents (id, user_id, name, model, provider, status) VALUES
('ag100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
 'Charging Concierge', 'gpt-3.5-turbo', 'openrouter', 'active');

-- ============================================
-- GRANT PERMISSIONS (adjust role name as needed)
-- ============================================

-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO evcharge_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO evcharge_app;
