# Low-Level Design (LLD)

**Project:** Peer-to-Peer EV Home-Charging Marketplace  
**Version:** 1.0  
**Date:** November 9, 2026

---

## 1. Database Schema

### 1.1 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │       │ user_roles  │       │   agents    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──────<│ user_id(FK) │       │ id (PK)     │
│ email       │       │ role        │       │ user_id(FK) │──┐
│ password    │       └─────────────┘       │ name        │  │
│ name        │                             │ model       │  │
│ phone       │       ┌─────────────┐       │ status      │  │
│ totp_secret │       │  mandates   │       │ public_key  │  │
│ created_at  │       ├─────────────┤       └─────────────┘  │
│ updated_at  │       │ id (PK)     │                        │
└─────────────┘       │ agent_id(FK)│<───────────────────────┘
       │              │ user_id(FK) │
       │              │ constraints │
       │              │ token       │
       │              │ status      │
       │              │ expires_at  │
       │              └─────────────┘
       │
       │              ┌─────────────┐       ┌─────────────────┐
       │              │  chargers   │       │  availability   │
       │              ├─────────────┤       ├─────────────────┤
       └─────────────>│ id (PK)     │──────<│ charger_id(FK)  │
                      │ host_id(FK) │       │ day_of_week     │
                      │ name        │       │ start_time      │
                      │ address     │       │ end_time        │
                      │ latitude    │       │ price_per_hour  │
                      │ longitude   │       └─────────────────┘
                      │ connector   │
                      │ kw_tier     │       ┌─────────────────┐
                      │ status      │       │  time_packages  │
                      └─────────────┘       ├─────────────────┤
                             │              │ id (PK)         │
                             │              │ charger_id(FK)  │
                             └─────────────>│ duration_min    │
                                            │ price           │
                                            │ name            │
                                            └─────────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  bookings   │       │  sessions   │       │  payments   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──────<│ booking_id  │       │ id (PK)     │
│ charger_id  │       │ start_time  │       │ booking_id  │
│ driver_id   │       │ end_time    │       │ paypal_order│
│ package_id  │       │ driver_conf │       │ paypal_auth │
│ start_time  │       │ host_conf   │       │ paypal_capt │
│ status      │       │ status      │       │ amount      │
│ mandate_id  │       └─────────────┘       │ host_payout │
│ created_at  │                             │ status      │
└─────────────┘                             └─────────────┘
       │
       │              ┌─────────────┐       ┌─────────────┐
       │              │  disputes   │       │  audit_log  │
       │              ├─────────────┤       ├─────────────┤
       └─────────────>│ booking_id  │       │ id (PK)     │
                      │ raised_by   │       │ agent_id    │
                      │ reason      │       │ mandate_id  │
                      │ evidence    │       │ action      │
                      │ ai_decision │       │ inputs      │
                      │ ai_confidence       │ outputs     │
                      │ final_decision      │ timestamp   │
                      │ refund_amount       └─────────────┘
                      │ status      │
                      └─────────────┘

┌───────────────────┐       ┌───────────────────┐
│  driver_ratings   │       │   host_ratings    │
├───────────────────┤       ├───────────────────┤
│ id (PK)           │       │ id (PK)           │
│ booking_id (FK)   │       │ booking_id (FK)   │
│ charger_id (FK)   │       │ driver_id (FK)    │
│ driver_id (FK)    │       │ host_id (FK)      │
│ rating (1-5)      │       │ rating (1-5)      │
│ review_text       │       │ review_text       │
│ created_at        │       │ created_at        │
└───────────────────┘       └───────────────────┘
```

### 1.2 Table Definitions

#### users
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    totp_secret     VARCHAR(255),  -- Encrypted
    totp_enabled    BOOLEAN DEFAULT FALSE,
    avatar_url      VARCHAR(500),
    is_verified     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

#### user_roles
```sql
CREATE TYPE user_role AS ENUM ('driver', 'host', 'admin');

CREATE TABLE user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        user_role NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
```

#### agents
```sql
CREATE TYPE agent_status AS ENUM ('active', 'revoked', 'suspended');

CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL DEFAULT 'Charging Concierge',
    model           VARCHAR(100) NOT NULL,  -- e.g., 'gpt-3.5-turbo'
    provider        VARCHAR(100) NOT NULL,  -- e.g., 'openrouter'
    version         VARCHAR(50),
    status          agent_status DEFAULT 'active',
    public_key      TEXT,  -- For signature verification
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agents_user ON agents(user_id);
```

#### mandates
```sql
CREATE TYPE mandate_status AS ENUM ('active', 'used', 'expired', 'revoked');

CREATE TABLE mandates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints (stored as JSONB for flexibility)
    max_amount      DECIMAL(10, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'INR',
    max_distance_km DECIMAL(5, 2),
    connector_types VARCHAR(50)[],  -- Array of allowed connector types
    
    -- Token
    token           TEXT NOT NULL,  -- Signed JWT
    
    -- Status tracking
    status          mandate_status DEFAULT 'active',
    amount_used     DECIMAL(10, 2) DEFAULT 0,
    bookings_count  INTEGER DEFAULT 0,
    
    -- Timestamps
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_mandates_agent ON mandates(agent_id);
CREATE INDEX idx_mandates_user ON mandates(user_id);
CREATE INDEX idx_mandates_status ON mandates(status);
```

#### chargers
```sql
CREATE TYPE connector_type AS ENUM ('Type2', 'CCS2', 'CHAdeMO', 'Type1', 'GBT');
CREATE TYPE kw_tier AS ENUM ('3.3kW', '7.4kW', '11kW', '22kW', '50kW', '150kW');
CREATE TYPE charger_status AS ENUM ('active', 'inactive', 'maintenance');

CREATE TABLE chargers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic info
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    
    -- Location
    address         VARCHAR(500) NOT NULL,
    city            VARCHAR(100) NOT NULL DEFAULT 'Bengaluru',
    latitude        DECIMAL(10, 8) NOT NULL,
    longitude       DECIMAL(11, 8) NOT NULL,
    
    -- Charger specs
    connector_type  connector_type NOT NULL,
    kw_tier         kw_tier NOT NULL,
    
    -- Amenities (JSONB for flexibility)
    amenities       JSONB DEFAULT '[]',  -- e.g., ["wifi", "restroom", "cafe"]
    
    -- Photos
    photos          VARCHAR(500)[],
    
    -- Status
    status          charger_status DEFAULT 'active',
    
    -- Stats
    total_bookings  INTEGER DEFAULT 0,
    avg_rating      DECIMAL(2, 1) DEFAULT 0,
    
    -- AI-suggested price (baseline)
    suggested_price DECIMAL(10, 2),
    
    -- Timestamps
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chargers_host ON chargers(host_id);
CREATE INDEX idx_chargers_location ON chargers USING GIST (
    ll_to_earth(latitude, longitude)
);
CREATE INDEX idx_chargers_status ON chargers(status);
CREATE INDEX idx_chargers_connector ON chargers(connector_type);
```

#### time_packages
```sql
CREATE TABLE time_packages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charger_id      UUID NOT NULL REFERENCES chargers(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,  -- e.g., "Quick Charge", "Standard", "Extended"
    duration_min    INTEGER NOT NULL,       -- Duration in minutes
    price           DECIMAL(10, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'INR',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_packages_charger ON time_packages(charger_id);
```

#### availability
```sql
CREATE TABLE availability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charger_id      UUID NOT NULL REFERENCES chargers(id) ON DELETE CASCADE,
    day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    is_available    BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX idx_availability_charger ON availability(charger_id);
```

#### bookings
```sql
CREATE TYPE booking_status AS ENUM (
    'pending',          -- Created, awaiting payment auth
    'authorized',       -- Payment authorized, awaiting session
    'in_progress',      -- Session started
    'completed',        -- Session ended, payment captured
    'cancelled',        -- Cancelled by driver
    'no_show',          -- Driver didn't show up
    'disputed'          -- Under dispute
);

CREATE TABLE bookings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    charger_id      UUID NOT NULL REFERENCES chargers(id),
    driver_id       UUID NOT NULL REFERENCES users(id),
    package_id      UUID NOT NULL REFERENCES time_packages(id),
    
    -- Timing
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end   TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Pricing
    base_amount     DECIMAL(10, 2) NOT NULL,
    platform_fee    DECIMAL(10, 2) NOT NULL,  -- 7%
    total_amount    DECIMAL(10, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'INR',
    
    -- Agent booking (nullable for manual bookings)
    mandate_id      UUID REFERENCES mandates(id),
    booked_by_agent BOOLEAN DEFAULT FALSE,
    
    -- Status
    status          booking_status DEFAULT 'pending',
    
    -- Cancellation
    cancelled_at    TIMESTAMP WITH TIME ZONE,
    cancellation_fee DECIMAL(10, 2),
    cancellation_reason TEXT,
    
    -- Timestamps
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_charger ON bookings(charger_id);
CREATE INDEX idx_bookings_driver ON bookings(driver_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_scheduled ON bookings(scheduled_start);
```

#### sessions
```sql
CREATE TYPE session_status AS ENUM (
    'awaiting_start',
    'driver_confirmed',
    'host_confirmed',
    'in_progress',
    'ended',
    'disputed'
);

CREATE TABLE sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- Confirmation tracking
    driver_start_confirm TIMESTAMP WITH TIME ZONE,
    host_start_confirm   TIMESTAMP WITH TIME ZONE,
    
    -- Actual timing
    actual_start        TIMESTAMP WITH TIME ZONE,
    actual_end          TIMESTAMP WITH TIME ZONE,
    actual_duration_min INTEGER,
    
    -- End confirmation
    driver_end_confirm  TIMESTAMP WITH TIME ZONE,
    host_end_confirm    TIMESTAMP WITH TIME ZONE,
    
    -- Final amount (may differ from booking if session ended early)
    final_amount        DECIMAL(10, 2),
    
    -- Status
    status              session_status DEFAULT 'awaiting_start',
    
    -- Notes
    notes               TEXT,
    
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_booking ON sessions(booking_id);
CREATE INDEX idx_sessions_status ON sessions(status);
```

#### payments
```sql
CREATE TYPE payment_status AS ENUM (
    'pending',
    'authorized',
    'captured',
    'partially_refunded',
    'refunded',
    'voided',
    'failed'
);

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id          UUID NOT NULL REFERENCES bookings(id),
    
    -- PayPal references
    paypal_order_id     VARCHAR(100),
    paypal_auth_id      VARCHAR(100),
    paypal_capture_id   VARCHAR(100),
    paypal_payout_id    VARCHAR(100),
    
    -- Amounts
    authorized_amount   DECIMAL(10, 2),
    captured_amount     DECIMAL(10, 2),
    refunded_amount     DECIMAL(10, 2) DEFAULT 0,
    host_payout_amount  DECIMAL(10, 2),
    platform_fee_amount DECIMAL(10, 2),
    currency            VARCHAR(3) DEFAULT 'INR',
    
    -- Status
    status              payment_status DEFAULT 'pending',
    
    -- Mandate tracking (for agent bookings)
    mandate_id          UUID REFERENCES mandates(id),
    
    -- Timestamps
    authorized_at       TIMESTAMP WITH TIME ZONE,
    captured_at         TIMESTAMP WITH TIME ZONE,
    refunded_at         TIMESTAMP WITH TIME ZONE,
    payout_at           TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_paypal_order ON payments(paypal_order_id);
CREATE INDEX idx_payments_status ON payments(status);
```

#### disputes
```sql
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

CREATE TABLE disputes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id          UUID NOT NULL REFERENCES bookings(id),
    
    -- Who raised it
    raised_by_id        UUID NOT NULL REFERENCES users(id),
    raised_by_role      user_role NOT NULL,
    
    -- Dispute details
    reason              VARCHAR(500) NOT NULL,
    description         TEXT,
    evidence            JSONB,  -- { photos: [], timestamps: {}, statements: {} }
    
    -- AI analysis
    ai_decision         dispute_decision,
    ai_refund_amount    DECIMAL(10, 2),
    ai_reasoning        TEXT,
    ai_confidence       DECIMAL(3, 2),  -- 0.00 to 1.00
    ai_reviewed_at      TIMESTAMP WITH TIME ZONE,
    
    -- Final decision
    final_decision      dispute_decision,
    final_refund_amount DECIMAL(10, 2),
    admin_notes         TEXT,
    resolved_by_id      UUID REFERENCES users(id),
    
    -- Status
    status              dispute_status DEFAULT 'open',
    
    -- Timestamps
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at         TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_disputes_booking ON disputes(booking_id);
CREATE INDEX idx_disputes_status ON disputes(status);
```

#### audit_log
```sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Agent tracking
    agent_id        UUID REFERENCES agents(id),
    mandate_id      UUID REFERENCES mandates(id),
    user_id         UUID REFERENCES users(id),
    
    -- Action details
    action          VARCHAR(100) NOT NULL,  -- e.g., 'search_chargers', 'create_booking_hold'
    inputs          JSONB,
    outputs         JSONB,
    
    -- Context
    booking_id      UUID REFERENCES bookings(id),
    paypal_order_id VARCHAR(100),
    
    -- Result
    success         BOOLEAN DEFAULT TRUE,
    error_message   TEXT,
    
    -- Performance
    duration_ms     INTEGER,
    
    -- Timestamp
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_agent ON audit_log(agent_id);
CREATE INDEX idx_audit_mandate ON audit_log(mandate_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

#### driver_ratings (Driver rates Charger)
```sql
CREATE TABLE driver_ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      UUID NOT NULL REFERENCES bookings(id),
    charger_id      UUID NOT NULL REFERENCES chargers(id),
    driver_id       UUID NOT NULL REFERENCES users(id),
    rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text     TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(booking_id)  -- One rating per booking
);

CREATE INDEX idx_driver_ratings_charger ON driver_ratings(charger_id);
```

#### host_ratings (Host rates Driver)
```sql
CREATE TABLE host_ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      UUID NOT NULL REFERENCES bookings(id),
    driver_id       UUID NOT NULL REFERENCES users(id),
    host_id         UUID NOT NULL REFERENCES users(id),
    rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text     TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(booking_id)  -- One rating per booking
);

CREATE INDEX idx_host_ratings_driver ON host_ratings(driver_id);
```

---

## 2. API Specifications

### 2.1 Authentication APIs

#### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "phone": "+919876543210",
  "role": "driver"  // or "host" or ["driver", "host"]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "roles": ["driver"]
    },
    "mfa_setup_required": true,
    "mfa_qr_code": "data:image/png;base64,...",
    "mfa_secret": "JBSWY3DPEHPK3PXP"  // Show once for manual entry
  }
}
```

#### POST /api/auth/login
Login step 1 - verify credentials.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "temp_token": "eyJhbGciOiJIUzI1NiIs...",
    "mfa_required": true
  }
}
```

#### POST /api/auth/verify-mfa
Login step 2 - verify TOTP code.

**Request:**
```json
{
  "temp_token": "eyJhbGciOiJIUzI1NiIs...",
  "totp_code": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 86400,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "roles": ["driver", "host"]
    }
  }
}
```

#### POST /api/auth/refresh
Refresh access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 86400
  }
}
```

---

### 2.2 Charger APIs

#### GET /api/chargers
Search chargers with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| lat | number | Latitude for proximity search |
| lng | number | Longitude for proximity search |
| radius | number | Search radius in km (default: 10) |
| connector | string | Filter by connector type |
| min_kw | number | Minimum kW tier |
| available_from | datetime | Start of availability window |
| available_to | datetime | End of availability window |
| max_price | number | Maximum price per hour |
| page | number | Page number (default: 1) |
| limit | number | Results per page (default: 20) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "chargers": [
      {
        "id": "uuid",
        "name": "Home Charger - HSR Layout",
        "address": "123 4th Cross, HSR Layout, Bengaluru",
        "latitude": 12.9141,
        "longitude": 77.6411,
        "distance_km": 2.3,
        "connector_type": "Type2",
        "kw_tier": "7.4kW",
        "host": {
          "id": "uuid",
          "name": "Priya S",
          "avg_rating": 4.8
        },
        "packages": [
          { "id": "uuid", "name": "Quick (30 min)", "duration_min": 30, "price": 75 },
          { "id": "uuid", "name": "Standard (1 hr)", "duration_min": 60, "price": 140 },
          { "id": "uuid", "name": "Extended (2 hr)", "duration_min": 120, "price": 260 }
        ],
        "avg_rating": 4.7,
        "total_bookings": 45,
        "amenities": ["wifi", "parking"],
        "photos": ["https://..."]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

#### POST /api/chargers
Create a new charger listing (Host only).

**Request:**
```json
{
  "name": "My Home Charger",
  "description": "7.4kW AC charger in covered parking",
  "address": "123 4th Cross, HSR Layout, Bengaluru",
  "latitude": 12.9141,
  "longitude": 77.6411,
  "connector_type": "Type2",
  "kw_tier": "7.4kW",
  "amenities": ["wifi", "parking", "restroom"],
  "photos": ["https://..."],
  "packages": [
    { "name": "Quick Charge", "duration_min": 30, "price": 75 },
    { "name": "Standard", "duration_min": 60, "price": 140 },
    { "name": "Extended", "duration_min": 120, "price": 260 }
  ],
  "availability": [
    { "day_of_week": 1, "start_time": "08:00", "end_time": "20:00" },
    { "day_of_week": 2, "start_time": "08:00", "end_time": "20:00" }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "charger": {
      "id": "uuid",
      "name": "My Home Charger",
      "suggested_price": 145,
      "price_explanation": "Based on 7.4kW tier and HSR Layout location, ₹145/hr is competitive..."
    }
  }
}
```

---

### 2.3 Booking APIs

#### POST /api/bookings
Create a booking with PayPal authorization.

**Request:**
```json
{
  "charger_id": "uuid",
  "package_id": "uuid",
  "scheduled_start": "2026-11-10T14:00:00+05:30"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "uuid",
      "charger_id": "uuid",
      "package": {
        "name": "Standard",
        "duration_min": 60
      },
      "scheduled_start": "2026-11-10T14:00:00+05:30",
      "scheduled_end": "2026-11-10T15:00:00+05:30",
      "base_amount": 140,
      "platform_fee": 9.80,
      "total_amount": 149.80,
      "status": "pending"
    },
    "paypal": {
      "order_id": "5O190127TN364715T",
      "approve_url": "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T"
    }
  }
}
```

#### POST /api/bookings/:id/cancel
Cancel a booking.

**Request:**
```json
{
  "reason": "Schedule changed"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "status": "cancelled",
    "cancellation_fee": 0,
    "refund_amount": 149.80,
    "message": "Cancelled more than 24 hours before - no fee"
  }
}
```

---

### 2.4 Session APIs

#### POST /api/sessions/:bookingId/start
Confirm session start (called by both driver and host).

**Request:**
```json
{
  "confirmed_by": "driver"  // or "host"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "booking_id": "uuid",
      "status": "driver_confirmed",
      "driver_start_confirm": "2026-11-10T14:02:00+05:30",
      "host_start_confirm": null,
      "message": "Waiting for host confirmation"
    }
  }
}
```

When both confirm:
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "booking_id": "uuid",
      "status": "in_progress",
      "actual_start": "2026-11-10T14:05:00+05:30",
      "scheduled_end": "2026-11-10T15:00:00+05:30",
      "message": "Session started. Scheduled to end at 3:00 PM"
    }
  }
}
```

#### POST /api/sessions/:bookingId/end
End session (triggers payment capture).

**Request:**
```json
{
  "confirmed_by": "driver"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "actual_start": "2026-11-10T14:05:00+05:30",
      "actual_end": "2026-11-10T14:50:00+05:30",
      "actual_duration_min": 45,
      "status": "ended"
    },
    "payment": {
      "captured_amount": 149.80,
      "host_payout": 139.31,
      "platform_fee": 10.49,
      "status": "captured"
    }
  }
}
```

---

### 2.5 Agent APIs

#### POST /api/agent/mandates
Create a new spending mandate.

**Request:**
```json
{
  "max_amount": 1000,
  "max_distance_km": 10,
  "connector_types": ["Type2", "CCS2"],
  "expires_in_hours": 24
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "mandate": {
      "id": "uuid",
      "agent_id": "uuid",
      "max_amount": 1000,
      "max_distance_km": 10,
      "connector_types": ["Type2", "CCS2"],
      "expires_at": "2026-11-10T10:00:00+05:30",
      "status": "active",
      "token": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

#### POST /api/agent/chat
Send message to the AI concierge.

**Request:**
```json
{
  "message": "I'm at 15% battery near Koramangala, need about 25 kWh by 6 PM, budget max 500 rupees",
  "mandate_token": "eyJhbGciOiJIUzI1NiIs...",
  "context": {
    "current_location": {
      "latitude": 12.9352,
      "longitude": 77.6245
    }
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "response": {
      "message": "I found 3 chargers that match your needs. Based on your budget of ₹500, location, and time constraint, I recommend **Priya's Home Charger** in HSR Layout because:\n\n1. **Distance**: Only 2.3 km from you\n2. **Price**: ₹260 for 2 hours (within budget)\n3. **Rating**: 4.8 stars from 45 bookings\n4. **Availability**: Open slot at 4 PM today\n\nWith a 7.4kW charger and 2 hours, you should gain about 30-35% charge.\n\nShall I book this for you?",
      "chargers_found": [
        {
          "id": "uuid",
          "name": "Priya's Home Charger",
          "distance_km": 2.3,
          "price": 260,
          "rating": 4.8,
          "recommended": true,
          "recommendation_reason": "Best value within budget and distance"
        }
      ],
      "suggested_action": {
        "type": "book",
        "charger_id": "uuid",
        "package_id": "uuid",
        "scheduled_start": "2026-11-09T16:00:00+05:30",
        "amount": 260
      }
    },
    "agent": {
      "id": "uuid",
      "mandate_id": "uuid",
      "mandate_remaining": 740,
      "tools_used": ["search_chargers", "get_host_details", "estimate_cost"]
    }
  }
}
```

#### POST /api/agent/chat (booking confirmation)
When user confirms booking suggestion.

**Request:**
```json
{
  "message": "Yes, book it",
  "mandate_token": "eyJhbGciOiJIUzI1NiIs...",
  "confirm_action": {
    "type": "book",
    "charger_id": "uuid",
    "package_id": "uuid",
    "scheduled_start": "2026-11-09T16:00:00+05:30"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "response": {
      "message": "I've created a booking for you at Priya's Home Charger. Please approve the ₹260 payment hold to confirm.",
      "booking_created": true
    },
    "booking": {
      "id": "uuid",
      "total_amount": 278.20,
      "status": "pending"
    },
    "paypal": {
      "order_id": "5O190127TN364715T",
      "approve_url": "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T"
    },
    "agent": {
      "id": "uuid",
      "mandate_id": "uuid",
      "mandate_remaining": 461.80,
      "audit_id": "uuid"
    }
  }
}
```

---

### 2.6 Dispute APIs

#### POST /api/disputes
Raise a dispute.

**Request:**
```json
{
  "booking_id": "uuid",
  "reason": "session_not_started",
  "description": "I arrived on time but the charger was not available. Host was not reachable.",
  "evidence": {
    "photos": ["https://..."],
    "timestamps": {
      "arrived_at": "2026-11-09T14:00:00+05:30",
      "left_at": "2026-11-09T14:30:00+05:30"
    }
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "dispute": {
      "id": "uuid",
      "booking_id": "uuid",
      "status": "ai_reviewed",
      "ai_analysis": {
        "decision": "full_refund",
        "refund_amount": 278.20,
        "reasoning": "Based on the evidence:\n1. Driver arrived within the booking window (confirmed by timestamp)\n2. No session start confirmation from host\n3. No contradicting evidence from host\n4. Audit log shows no agent anomalies\n\nRecommendation: Full refund to driver.",
        "confidence": 0.97
      },
      "auto_resolved": true,
      "message": "Dispute resolved automatically. Full refund of ₹278.20 will be processed."
    }
  }
}
```

---

### 2.7 Webhook Handler

#### POST /api/webhooks/paypal
Handle PayPal webhook events.

**Events Handled:**
| Event | Action |
|-------|--------|
| `CHECKOUT.ORDER.APPROVED` | Update booking status to 'authorized' |
| `PAYMENT.AUTHORIZATION.CREATED` | Store authorization ID |
| `PAYMENT.CAPTURE.COMPLETED` | Update payment status, trigger payout |
| `PAYMENT.CAPTURE.DENIED` | Mark payment failed |
| `PAYMENT.CAPTURE.REFUNDED` | Update refund status |

---

## 3. Component Specifications

### 3.1 AI Module

#### LLM Client Configuration
```typescript
interface LLMConfig {
  provider: 'openrouter';
  model: 'openai/gpt-3.5-turbo' | 'anthropic/claude-3-haiku';
  apiKey: string;
  baseUrl: 'https://openrouter.ai/api/v1';
  timeout: 30000;  // 30 seconds
  maxRetries: 2;
  temperature: 0;  // Deterministic
}
```

#### Tool Schemas (OpenAI Function Calling Format)
```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_chargers',
      description: 'Search for available EV chargers near a location',
      parameters: {
        type: 'object',
        properties: {
          latitude: { type: 'number', description: 'Latitude coordinate' },
          longitude: { type: 'number', description: 'Longitude coordinate' },
          radius_km: { type: 'number', description: 'Search radius in kilometers', default: 10 },
          connector_type: { 
            type: 'array', 
            items: { type: 'string', enum: ['Type2', 'CCS2', 'CHAdeMO'] },
            description: 'Filter by connector types'
          },
          min_kw: { type: 'number', description: 'Minimum power tier in kW' },
          max_price: { type: 'number', description: 'Maximum price per hour' },
          available_from: { type: 'string', format: 'date-time' },
          available_to: { type: 'string', format: 'date-time' }
        },
        required: ['latitude', 'longitude']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_host_details',
      description: 'Get detailed information about a charger and its host',
      parameters: {
        type: 'object',
        properties: {
          charger_id: { type: 'string', description: 'UUID of the charger' }
        },
        required: ['charger_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'estimate_cost',
      description: 'Calculate the estimated cost for a charging session',
      parameters: {
        type: 'object',
        properties: {
          charger_id: { type: 'string' },
          package_id: { type: 'string' },
        },
        required: ['charger_id', 'package_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_booking_hold',
      description: 'Create a booking with payment authorization. ONLY call this after user confirms.',
      parameters: {
        type: 'object',
        properties: {
          charger_id: { type: 'string' },
          package_id: { type: 'string' },
          scheduled_start: { type: 'string', format: 'date-time' }
        },
        required: ['charger_id', 'package_id', 'scheduled_start']
      }
    }
  }
];
```

#### Dispute Resolver Output Schema
```typescript
interface DisputeResolution {
  decision: 'release_to_host' | 'partial_refund' | 'full_refund';
  refund_amount: number;  // 0 if release_to_host
  reasoning: string;
  confidence: number;  // 0.00 to 1.00
  evidence_summary: {
    booking_data: object;
    session_data: object;
    audit_trail: object[];
    driver_statement: string;
    host_statement?: string;
  };
}
```

### 3.2 PayPal Module

#### Order Creation
```typescript
interface CreateOrderParams {
  booking_id: string;
  amount: number;
  currency: string;
  description: string;
  mandate_id?: string;  // For agent bookings
}

interface CreateOrderResponse {
  order_id: string;
  approve_url: string;
  status: 'CREATED';
}
```

#### Authorization
```typescript
interface AuthorizeOrderParams {
  order_id: string;
}

interface AuthorizeOrderResponse {
  authorization_id: string;
  status: 'COMPLETED';
  amount: {
    value: string;
    currency_code: string;
  };
}
```

#### Capture
```typescript
interface CaptureAuthParams {
  authorization_id: string;
  amount: number;  // Can be less than authorized
  final_capture: boolean;
}

interface CaptureAuthResponse {
  capture_id: string;
  status: 'COMPLETED';
  amount: {
    value: string;
    currency_code: string;
  };
}
```

#### Payout
```typescript
interface CreatePayoutParams {
  recipient_email: string;  // Host's PayPal email
  amount: number;
  currency: string;
  note: string;
  booking_id: string;
}

interface CreatePayoutResponse {
  payout_batch_id: string;
  status: 'PENDING' | 'SUCCESS';
}
```

### 3.3 KYA Module

#### Mandate Token Structure
```typescript
interface MandatePayload {
  mandate_id: string;
  agent_id: string;
  user_id: string;
  constraints: {
    max_amount: number;
    currency: string;
    max_distance_km: number;
    connector_types: string[];
  };
  iat: number;  // Issued at
  exp: number;  // Expiry
}
```

#### Verification Flow
```typescript
async function verifyMandate(token: string, action: AgentAction): Promise<VerificationResult> {
  // 1. Verify JWT signature
  const payload = jwt.verify(token, JWT_SECRET);
  
  // 2. Check if mandate exists and is active
  const mandate = await db.mandates.findUnique({ where: { id: payload.mandate_id } });
  if (!mandate || mandate.status !== 'active') {
    return { valid: false, reason: 'Mandate revoked or invalid' };
  }
  
  // 3. Check expiry
  if (new Date() > new Date(mandate.expires_at)) {
    return { valid: false, reason: 'Mandate expired' };
  }
  
  // 4. Check spending limit
  if (mandate.amount_used + action.amount > mandate.max_amount) {
    return { valid: false, reason: 'Exceeds spending cap' };
  }
  
  // 5. Check distance constraint
  if (action.distance_km > mandate.max_distance_km) {
    return { valid: false, reason: 'Exceeds distance limit' };
  }
  
  // 6. Check connector type
  if (!mandate.connector_types.includes(action.connector_type)) {
    return { valid: false, reason: 'Connector type not allowed' };
  }
  
  return { valid: true };
}
```

---

## 4. Error Handling

### 4.1 Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "This time slot is no longer available",
    "details": {
      "charger_id": "uuid",
      "requested_slot": "2026-11-10T14:00:00+05:30",
      "conflicting_booking": "uuid"
    }
  }
}
```

### 4.2 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_INVALID_CREDENTIALS | 401 | Wrong email or password |
| AUTH_MFA_REQUIRED | 401 | MFA verification needed |
| AUTH_MFA_INVALID | 401 | Invalid TOTP code |
| AUTH_TOKEN_EXPIRED | 401 | JWT expired |
| FORBIDDEN | 403 | Not authorized for this action |
| NOT_FOUND | 404 | Resource not found |
| BOOKING_CONFLICT | 409 | Time slot not available |
| MANDATE_INVALID | 400 | Mandate verification failed |
| MANDATE_EXPIRED | 400 | Mandate has expired |
| MANDATE_EXCEEDED | 400 | Action exceeds mandate limits |
| PAYPAL_ERROR | 502 | PayPal API error |
| AI_ERROR | 502 | LLM API error |
| VALIDATION_ERROR | 400 | Request validation failed |

---

## 5. Seed Data

### 5.1 Demo Users
```sql
-- Driver account
INSERT INTO users (id, email, password_hash, name, phone) VALUES
('d1000000-0000-0000-0000-000000000001', 'driver@demo.com', '$2b$10$...', 'Rahul Kumar', '+919876543210');

INSERT INTO user_roles (user_id, role) VALUES
('d1000000-0000-0000-0000-000000000001', 'driver');

-- Host account
INSERT INTO users (id, email, password_hash, name, phone) VALUES
('h1000000-0000-0000-0000-000000000001', 'demo_host@example.com', '$2b$10$...', 'Priya Sharma', '+919876543211');

INSERT INTO user_roles (user_id, role) VALUES
('h1000000-0000-0000-0000-000000000001', 'host');

-- Admin account
INSERT INTO users (id, email, password_hash, name, phone) VALUES
('a1000000-0000-0000-0000-000000000001', 'demo_admin@example.com', '$2b$10$...', 'Admin User', '+919876543212');

INSERT INTO user_roles (user_id, role) VALUES
('a1000000-0000-0000-0000-000000000001', 'admin');
```

### 5.2 Demo Chargers (Bengaluru)
```sql
-- HSR Layout charger
INSERT INTO chargers (id, host_id, name, address, city, latitude, longitude, connector_type, kw_tier) VALUES
('c1000000-0000-0000-0000-000000000001', 'h1000000-0000-0000-0000-000000000001', 
 'Priya''s Home Charger', '123 4th Cross, HSR Layout, Bengaluru', 'Bengaluru',
 12.9141, 77.6411, 'Type2', '7.4kW');

-- Koramangala charger
INSERT INTO chargers (id, host_id, name, address, city, latitude, longitude, connector_type, kw_tier) VALUES
('c1000000-0000-0000-0000-000000000002', 'h1000000-0000-0000-0000-000000000001',
 'Cafe Charger - Koramangala', '45 5th Block, Koramangala, Bengaluru', 'Bengaluru',
 12.9352, 77.6245, 'CCS2', '22kW');

-- Indiranagar charger
INSERT INTO chargers (id, host_id, name, address, city, latitude, longitude, connector_type, kw_tier) VALUES
('c1000000-0000-0000-0000-000000000003', 'h1000000-0000-0000-0000-000000000001',
 'Apartment Complex Charger', '78 100 Feet Road, Indiranagar, Bengaluru', 'Bengaluru',
 12.9784, 77.6408, 'Type2', '11kW');
```

### 5.3 Demo Packages
```sql
-- HSR Layout packages
INSERT INTO time_packages (charger_id, name, duration_min, price) VALUES
('c1000000-0000-0000-0000-000000000001', 'Quick Charge', 30, 75),
('c1000000-0000-0000-0000-000000000001', 'Standard', 60, 140),
('c1000000-0000-0000-0000-000000000001', 'Extended', 120, 260);

-- Koramangala packages (faster charger = higher price)
INSERT INTO time_packages (charger_id, name, duration_min, price) VALUES
('c1000000-0000-0000-0000-000000000002', 'Quick Boost', 30, 150),
('c1000000-0000-0000-0000-000000000002', 'Standard', 60, 280),
('c1000000-0000-0000-0000-000000000002', 'Extended', 120, 520);
```

---

## 6. Related Documents

- [DECISIONS.md](./DECISIONS.md) - All project decisions
- [HLD.md](./HLD.md) - High-Level Design
- [ADR-001](./ADR-001.md) - Original Architecture Decision Record
