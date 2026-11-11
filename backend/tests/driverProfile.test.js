import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDriverHistory } from '../src/services/agent.service.js';

const booking = (over = {}) => ({
  status: 'completed', totalAmount: 100, currency: 'INR',
  scheduledStart: new Date('2026-11-01T07:00:00'), scheduledEnd: new Date('2026-11-01T08:00:00'),
  charger: { name: 'A', city: 'Bengaluru', connectorType: 'Type2', kwTier: 'kW7_4' },
  session: { energyKwh: 5 },
  ...over,
});

test('no history gives no profile', () => {
  assert.equal(summarizeDriverHistory([]), null);
});

test('summarizes spend, duration, favourites and cancellations', () => {
  const p = summarizeDriverHistory([
    booking(),
    booking({ totalAmount: 200, charger: { name: 'B', city: 'Bengaluru', connectorType: 'Type2', kwTier: 'kW22' } }),
    booking({ totalAmount: 60, charger: { name: 'C', city: 'Mysuru', connectorType: 'CCS2', kwTier: 'kW22' } }),
    booking({ status: 'cancelled' }),
  ]);
  assert.equal(p.completedSessions, 3);
  assert.equal(p.cancelledBookings, 1);
  assert.equal(p.totalSpent, 360);
  assert.equal(p.avgSpendPerSession, 120);
  assert.equal(p.avgSessionMinutes, 60);
  assert.equal(p.totalEnergyKwh, 15);
  assert.equal(p.favouriteConnectors[0], 'Type2');
  assert.equal(p.favouriteAreas[0], 'Bengaluru');
  assert.equal(p.usualTimeOfDay, 'morning');
  assert.deepEqual(p.recentChargers, ['A', 'B', 'C']);
});

test('only cancelled bookings give a profile with no spend', () => {
  const p = summarizeDriverHistory([booking({ status: 'cancelled' })]);
  assert.equal(p.completedSessions, 0);
  assert.equal(p.avgSpendPerSession, null);
});
