# Kiro Agent Guide - EV Charging Marketplace

> Quick reference guide for AI agents working on this project.

---

## Project Overview

**What:** Peer-to-peer EV home-charging marketplace (Airbnb for EV charging)
**Stack:** React (Vite) + Node.js (Express) + PostgreSQL + Prisma
**Ports:** Frontend: 5173, Backend: 4000

---

## Quick Start

```bash
# One command to start everything
./setup.sh

# Or manually:
cd backend && npm run dev    # Terminal 1
cd frontend && npm run dev   # Terminal 2
```

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Client | client@demo.com | Demo123! |
| Host | host@demo.com | Demo123! |
| Client+Host | clienthost@demo.com | Demo123! |
| Admin | admin@evcharge.com | Demo123! |

---

## Key Directories

```
ev-charging-marketplace/
├── backend/
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation
│   │   └── utils/          # Helpers
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       └── seed.js         # Demo data
├── frontend/
│   ├── src/
│   │   ├── components/ui/  # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── pages/admin/    # Admin dashboard pages
│   │   ├── services/       # API clients
│   │   └── store/          # Zustand state
│   └── ...
└── docs/
    ├── ISSUES_AND_SOLUTIONS.md  # Debugging reference
    └── KIRO_AGENT_GUIDE.md      # This file
```

---

## Common Tasks

### Add a new API endpoint

1. Create/edit route in `backend/src/routes/`
2. Add business logic in `backend/src/services/`
3. **Restart backend** to pick up changes

### Add a new frontend page

1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.jsx`
3. Export from index if in admin folder

### Modify database schema

1. Edit `backend/prisma/schema.prisma`
2. Run `cd backend && npx prisma db push`
3. Update seed.js if needed
4. Re-run `node prisma/seed.js`

### Fix UI component

UI components are in `frontend/src/components/ui/`:
- `Button.jsx` - Primary, secondary, outline variants
- `Card.jsx` - Card, CardBody, CardHeader, CardFooter
- `Input.jsx` - Text input with label
- `Select.jsx` - Custom dropdown (NOT native HTML select)
- `Modal.jsx` - Dialog overlay
- `Badge.jsx` - Status badges
- `Loading.jsx` - Spinners and skeletons
- `StarRating.jsx` - Rating display and input

---

## Important Patterns

### Backend Response Format

```javascript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { code: 'ERROR_CODE', message: 'Human message' } }

// Paginated
{ success: true, data: [...], pagination: { page, limit, total, pages } }
```

### Frontend API Calls

```javascript
import api from '../services/api';

// GET
const response = await api.get('/endpoint');
const data = response.data.data;

// POST
const response = await api.post('/endpoint', { body });
```

### Custom Select Component

```jsx
// CORRECT - Custom Select
import { Select } from '../components/ui';
<Select
  value={value}
  onChange={setValue}  // Direct value, NOT e.target.value
  options={[
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
  ]}
/>

// WRONG - Don't use native select
<select onChange={(e) => setValue(e.target.value)}>
```

### Card Padding

Always add padding to Card contents:
```jsx
<Card className="p-6">
  {/* content */}
</Card>
// OR
<Card>
  <CardBody>  {/* CardBody has p-8 by default */}
    {/* content */}
  </CardBody>
</Card>
```

---

## Database Field Names

### Booking Model
| Frontend expects | Prisma schema |
|------------------|---------------|
| startTime | scheduledStart |
| endTime | scheduledEnd |
| userId | driverId |

### Charger Model
| Frontend expects | Prisma schema |
|------------------|---------------|
| title | name |
| images | photos |

### Booking Status Values
| Display | Database value |
|---------|----------------|
| Confirmed | authorized |
| In Progress | in_progress |
| Completed | completed |
| Cancelled | cancelled |
| No Show | no_show |

---

## Debugging Checklist

### Data not showing?
1. Check browser Network tab for API errors
2. Verify endpoint exists and is correctly named
3. Check field name mappings (see above)
4. Ensure backend was restarted after code changes

### Stats showing ₹0?
1. Check if Payment records exist
2. Payments need `status: 'captured'` to count as revenue
3. Host earnings come from `hostPayoutAmount` field

### Auth errors?
1. Clear localStorage: `localStorage.clear()`
2. Login again
3. Check token in Network tab Authorization header

### Backend endpoint not found?
1. **Restart the backend server**
2. Check route is registered in correct routes file
3. Check middleware (authenticate, requireRole)

---

## API Endpoints Quick Reference

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Users
- `GET /api/users/profile`
- `POST /api/users/roles` - Add role (driver/host)
- `GET /api/users/host/stats` - Host dashboard stats
- `GET /api/users/dashboard` - Combined stats

### Chargers
- `GET /api/chargers` - Search
- `GET /api/chargers/:id` - Details
- `POST /api/chargers` - Create (host)
- `GET /api/chargers/mine` - Host's chargers

### Bookings
- `GET /api/bookings` - User's bookings
- `GET /api/bookings/host` - Host's bookings
- `POST /api/bookings` - Create
- `GET /api/bookings/:id` - Details

### Admin
- `GET /api/admin/dashboard`
- `GET /api/admin/users`
- `GET /api/admin/bookings`
- `GET /api/admin/payments`
- `GET /api/admin/chargers`
- `GET /api/admin/analytics/*`

---

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
PAYPAL_CLIENT_ID=...
OPENROUTER_API_KEY=...
PORT=4000
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:4000/api
VITE_PAYPAL_CLIENT_ID=...
```

---

## Tests

```bash
# Backend syntax check
cd backend && node --check src/routes/user.routes.js

# Frontend build (catches compile errors)
cd frontend && npm run build

# Test API endpoint
curl http://localhost:4000/api/chargers | jq .
```

---

## Common Fixes

### "Route not found"
→ Restart backend: `cd backend && npm run dev`

### "Cannot read property of undefined"
→ Check field name mapping, add optional chaining (`?.`)

### "Export button does nothing"
→ Import and use `exportToCSV` from `utils/export.js`

### "Select dropdown not working"
→ Use `onChange={setValue}` not `onChange={(e) => setValue(e.target.value)}`

---

*See `docs/ISSUES_AND_SOLUTIONS.md` for detailed problem/solution documentation.*
