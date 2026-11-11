import test from 'node:test';
import assert from 'node:assert/strict';
import { rankChargers } from '../src/services/charger.service.js';

const charger = (id, over = {}) => ({
  id,
  name: id,
  address: 'x',
  kwTier: 'kW7_4',
  distanceKm: 3,
  avgRating: 4,
  totalBookings: 10,
  packages: [{ durationMin: 60, price: 100, currency: 'INR' }],
  ...over,
});

const set = [
  charger('near', { distanceKm: 0.5, kwTier: 'kW7_4', packages: [{ durationMin: 60, price: 150, currency: 'INR' }] }),
  charger('fast', { distanceKm: 8, kwTier: 'kW50', packages: [{ durationMin: 60, price: 400, currency: 'INR' }] }),
  charger('cheap', { distanceKm: 5, kwTier: 'kW3_3', avgRating: 3, packages: [{ durationMin: 60, price: 40, currency: 'INR' }] }),
  charger('loved', { distanceKm: 6, avgRating: 4.9, packages: [{ durationMin: 60, price: 200, currency: 'INR' }] }),
];

test('each priority puts the matching charger first', () => {
  assert.equal(rankChargers(set, 'nearest')[0].chargerId, 'near');
  assert.equal(rankChargers(set, 'fastest')[0].chargerId, 'fast');
  assert.equal(rankChargers(set, 'cheapest')[0].chargerId, 'cheap');
  assert.equal(rankChargers(set, 'best_rated')[0].chargerId, 'loved');
});

test('returns at most the top three, best score first', () => {
  const picks = rankChargers(set, 'balanced');
  assert.equal(picks.length, 3);
  assert.ok(picks[0].score >= picks[1].score && picks[1].score >= picks[2].score);
});

test('an unrated charger gets a neutral rating, not zero', () => {
  const [pick] = rankChargers([charger('new', { avgRating: 0, totalBookings: 0 })]);
  assert.equal(pick.rating, 3);
  assert.equal(pick.rated, false);
});

test('chargers without a rate or a known power are skipped; empty input is safe', () => {
  assert.deepEqual(rankChargers([]), []);
  assert.deepEqual(rankChargers([charger('x', { packages: [] })]), []);
  assert.deepEqual(rankChargers([charger('y', { kwTier: 'unknown' })]), []);
});

test('an unknown priority falls back to balanced', () => {
  assert.deepEqual(rankChargers(set, 'nonsense'), rankChargers(set, 'balanced'));
});
