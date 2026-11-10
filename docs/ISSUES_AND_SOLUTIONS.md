# Issues and Solutions - EV Charging Marketplace

> This document captures all issues encountered during development and their solutions for future reference.

---

## Table of Contents
1. [Backend Issues](#backend-issues)
2. [Frontend Issues](#frontend-issues)
3. [Database Issues](#database-issues)
4. [UI/UX Issues](#uiux-issues)
5. [Configuration](#configuration)

---

## Backend Issues

### 1. Host Stats Endpoint Missing

**Problem:** Host dashboard showed ₹0 for all earnings even though bookings existed with payments.

**Root Cause:** The frontend was calling `GET /api/users/host/stats` but this endpoint didn't exist. The `/api/users/dashboard` endpoint had host stats but in a different structure.

**Solution:** Created new endpoint in `backend/src/routes/user.routes.js`:

```javascript
router.get('/host/stats', authenticate, requireRole('host'), async (req, res, next) => {
  const chargers = await prisma.charger.findMany({
    where: { hostId: req.user.id },
    select: { id: true, status: true, avgRating: true }
  });
  
  const chargerIds = chargers.map(c => c.id);
  
  const totalEarnings = await prisma.payment.aggregate({
    where: {
      booking: { chargerId: { in: chargerIds } },
      status: 'captured',
    },
    _sum: { hostPayoutAmount: true },
  });
  
  // ... rest of stats
});
```

**File:** `backend/src/routes/user.routes.js`

---

### 2. Booking Field Name Mismatches

**Problem:** Frontend expected field names like `startTime`, `endTime`, `title`, `images` but backend returned `scheduledStart`, `scheduledEnd`, `name`, `photos`.

**Root Cause:** Backend Prisma schema uses different naming conventions than what frontend components expected.

**Solution:** Updated backend service to return aliased fields:

```javascript
// backend/src/services/booking.service.js
return {
  ...booking,
  startTime: booking.scheduledStart,
  endTime: booking.scheduledEnd,
  charger: {
    ...booking.charger,
    photos: booking.charger.photos || [],
  }
};
```

**Files Modified:**
- `backend/src/services/booking.service.js`
- `frontend/src/pages/BookingsPage.jsx`
- `frontend/src/pages/BookingDetailPage.jsx`
- `frontend/src/pages/DashboardPage.jsx`

---

### 3. Status Value Mismatches

**Problem:** Backend used status values like `authorized`, `in_progress` but frontend expected `confirmed`, `active`.

**Solution:** Added status mapping in frontend:

```javascript
const STATUS_CONFIG = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  authorized: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Confirmed' },
  in_progress: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Progress' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
  no_show: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'No Show' },
};
```

**Files:** `frontend/src/pages/BookingsPage.jsx`, `frontend/src/pages/BookingDetailPage.jsx`

---

### 4. Admin Bookings Page Missing

**Problem:** `/admin/bookings` route returned null/error because `AdminBookingsPage` component didn't exist.

**Solution:** Created new `AdminBookingsPage.jsx` with:
- Table view of all bookings
- Status filters using custom Select
- Pagination
- Booking details sidebar
- Export functionality

**Files:**
- Created: `frontend/src/pages/admin/AdminBookingsPage.jsx`
- Updated: `frontend/src/pages/admin/index.js` (added export)
- Updated: `frontend/src/App.jsx` (added route)

---

## Frontend Issues

### 5. Card Padding Inconsistency

**Problem:** Some Cards had proper padding, others had content flush against edges.

**Solution:** Added consistent padding classes:

```jsx
// Search page charger cards
<Card className="p-5">

// Charger detail page sections
<Card className="p-6">

// Agent settings page
<Card className="p-6">
```

**Files Modified:**
- `frontend/src/pages/SearchPage.jsx`
- `frontend/src/pages/ChargerDetailPage.jsx`
- `frontend/src/pages/AgentSettingsPage.jsx`

---

### 6. Native HTML Select Dropdowns

**Problem:** Classic HTML `<select>` elements looked outdated and inconsistent with modern UI.

**Solution:** Created custom `Select` component with:
- Modern styling with Tailwind
- Keyboard navigation (Arrow keys, Enter, Escape)
- Checkmarks for selected option
- Smooth animations
- Consistent look across all pages

**File Created:** `frontend/src/components/ui/Select.jsx`

```jsx
export function Select({ value, onChange, options, placeholder, className }) {
  // Custom dropdown with Listbox from @headlessui/react pattern
}
```

**Pages Updated:**
- `SearchPage.jsx` - Connector type filter
- `BookingDetailPage.jsx` - Dispute reason
- `AdminUsersPage.jsx` - Role filter
- `AdminPaymentsPage.jsx` - Status filter
- `AdminAnalyticsPage.jsx` - Period selector
- `AdminAuditLogsPage.jsx` - Action type filter
- `AdminDisputesPage.jsx` - Resolution decision
- `AdminChargersPage.jsx` - Status filter and change

---

### 7. Custom Select onChange Handler Mismatch

**Problem:** After replacing native `<select>` with custom `Select`, filters stopped working because the onChange signature was different.

**Root Cause:** 
- Native select: `onChange={(e) => setValue(e.target.value)}`
- Custom Select: `onChange={(value) => setValue(value)}`

**Solution:** Updated all onChange handlers:

```jsx
// Before (native select pattern)
<Select onChange={(e) => setFilter(e.target.value)} />

// After (custom Select pattern)
<Select onChange={setFilter} />
// or
<Select onChange={(value) => handleChange('field', value)} />
```

---

### 8. Export Buttons Not Working

**Problem:** Admin pages had "Export" buttons that did nothing when clicked.

**Solution:** Created export utility and wired buttons:

**File Created:** `frontend/src/utils/export.js`

```javascript
export function exportToCSV(data, filename, columnMapping) {
  // Convert data to CSV with proper escaping
  // Auto-download file
}
```

**Implementation:**
```jsx
const handleExport = () => {
  exportToCSV(users, 'users', {
    'Name': 'name',
    'Email': 'email',
    'Roles': 'roles',
    'Joined': 'createdAt',
  });
};
```

---

### 9. "Become a Host" Page Missing

**Problem:** Clicking "Become a Host" navigated to `/host/register` which didn't exist.

**Solution:** Created `BecomeHostPage.jsx` with:
- Benefits display
- How it works section
- Terms agreement checkbox
- API call to `POST /api/users/roles` with `{ role: 'host' }`
- Success state with next steps

**Files:**
- Created: `frontend/src/pages/BecomeHostPage.jsx`
- Updated: `frontend/src/App.jsx` (added route)

---

## Database Issues

### 10. Mock Bookings Without Payments

**Problem:** Admin dashboard showed ₹0 revenue because bookings were created without corresponding Payment records.

**Solution:** Updated seed file to create Payment records for completed bookings:

```javascript
if (bookingData.status === 'completed') {
  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      authorizedAmount: bookingData.totalAmount,
      capturedAmount: bookingData.totalAmount,
      hostPayoutAmount: bookingData.baseAmount,
      platformFeeAmount: bookingData.platformFee,
      status: 'captured',
      capturedAt: bookingData.scheduledEnd,
      // ... PayPal mock IDs
    },
  });
}
```

**File:** `backend/prisma/seed.js`

---

### 11. Seed Booking Field Names

**Problem:** Seed file used wrong field names like `userId` instead of `driverId`, `startTime` instead of `scheduledStart`.

**Solution:** Updated to match Prisma schema:

```javascript
// Before
{ userId: driver.id, startTime: date, status: 'confirmed' }

// After
{ driverId: driver.id, scheduledStart: date, status: 'authorized' }
```

---

### 12. Payment Model Field Names

**Problem:** Seed tried to create Payment with `payerId`, `amount`, `paypalAuthorizationId` which don't exist in schema.

**Solution:** Used correct field names from Prisma schema:

```javascript
// Before (incorrect)
{ payerId: driver.id, amount: 100, paypalAuthorizationId: 'xxx' }

// After (correct)
{ authorizedAmount: 100, capturedAmount: 100, paypalAuthId: 'xxx' }
```

---

## UI/UX Issues

### 13. Host Dashboard "This Month" Showing Wrong Data

**Problem:** "This Month" in Earnings Summary showed `pendingPayout` instead of actual monthly earnings.

**Solution:** 
1. Added `thisMonthEarnings` to backend response
2. Updated frontend to use correct field

```jsx
<div className="flex justify-between py-2">
  <span>This Month</span>
  <span className="text-green-600">{formatCurrency(stats.thisMonthEarnings)}</span>
</div>
```

---

## Configuration

### 14. Demo Account Email Consistency

**Problem:** Different emails used in docs vs seed file (driver@demo.com vs client@demo.com).

**Solution:** Standardized demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Client | client@demo.com | Demo123! |
| Host | host@demo.com | Demo123! |
| Client+Host | clienthost@demo.com | Demo123! |
| Admin | admin@evcharge.com | Demo123! |

**Files Updated:**
- `backend/prisma/seed.js`
- `README.md`

---

## Quick Reference

### Backend Port
- Default: `4000`
- Health check: `GET http://localhost:4000/health`

### Frontend Port
- Default: `5173`
- URL: `http://localhost:5173`

### Common Commands

```bash
# Restart backend (after code changes)
cd backend && npm run dev

# Re-seed database
cd backend && node prisma/seed.js

# Reset database completely
cd backend && npx prisma db push --force-reset && node prisma/seed.js

# Build frontend
cd frontend && npm run build
```

### Debugging Tips

1. **API not responding:** Check if backend is running on port 4000
2. **Data not showing:** Check browser console for API errors
3. **Auth issues:** Clear localStorage and login again
4. **Stats showing 0:** Ensure Payment records exist with `status: 'captured'`

---

*Last Updated: November 2026*
