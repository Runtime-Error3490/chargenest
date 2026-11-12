import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocodePlace, collectRefs, stripInternalNotes } from '../src/services/agent.service.js';
import { toolAllowedForRoles, TOOL_ACTIONS } from '../src/services/agentPolicy.js';

const fakeFetch = (rows, calls = []) => async (url, opts) => {
  calls.push({ url: String(url), opts });
  return { ok: true, status: 200, json: async () => rows };
};

test('turns a place name into coordinates', async () => {
  const calls = [];
  const places = await geocodePlace('Testville Alpha, Bengaluru', fakeFetch([
    { display_name: 'Testville Alpha, Bengaluru, Karnataka, India', lat: '13.0285001', lon: '77.5400002', type: 'suburb' },
  ], calls));
  assert.equal(places.length, 1);
  assert.equal(places[0].latitude, 13.0285);
  assert.equal(places[0].longitude, 77.54);
  assert.match(calls[0].url, /q=Testville\+Alpha%2C\+Bengaluru/);
  assert.match(calls[0].url, /countrycodes=in/);
  assert.ok(calls[0].opts.headers['User-Agent']);
});

test('caches a repeated lookup', async () => {
  const calls = [];
  const f = fakeFetch([{ display_name: 'Cacheville', lat: '1', lon: '2', type: 'city' }], calls);
  await geocodePlace('Cacheville', f);
  await geocodePlace('  cacheville ', f);
  assert.equal(calls.length, 1);
});

test('no match gives an empty list, bad input and HTTP errors throw', async () => {
  assert.deepEqual(await geocodePlace('Nowhereland Xyz', fakeFetch([])), []);
  await assert.rejects(() => geocodePlace(' '));
  await assert.rejects(
    () => geocodePlace('Brokenville', async () => ({ ok: false, status: 503, json: async () => [] })),
    /503/,
  );
});

test('find_place is a driver-only tool', () => {
  assert.deepEqual(TOOL_ACTIONS.find_place, ['search_chargers']);
  assert.equal(toolAllowedForRoles('find_place', ['driver']), true);
  assert.equal(toolAllowedForRoles('find_place', ['host']), false);
});

test('collectRefs keeps charger and package ids from search and recommend results', () => {
  const refs = new Map();
  collectRefs(refs, [
    { id: 'c1', name: 'Alpha', packages: [{ id: 'p1', durationMin: 60, price: '180' }] },
  ]);
  collectRefs(refs, { top: [{ chargerId: 'c2', name: 'Beta', hourlyRate: 45 }] });
  collectRefs(refs, { chargerId: 'c1', name: 'Alpha' }); // does not wipe c1's packages
  assert.deepEqual(refs.get('c1').packages, [{ id: 'p1', minutes: 60, price: 180 }]);
  assert.equal(refs.get('c2').name, 'Beta');
  assert.equal(refs.get('c2').packages, undefined);
});

test('stripInternalNotes removes a copied tool-data note but keeps the reply', () => {
  const reply = 'Pick one.\n\n[Tool data from this reply, internal: {"chargers": [{"id": "x"}]}]';
  assert.equal(stripInternalNotes(reply), 'Pick one.');
  assert.equal(stripInternalNotes('[Known chargers, internal ids: []]\nHello'), 'Hello');
  assert.equal(stripInternalNotes('Plain **markdown** [link](http://a.b)'), 'Plain **markdown** [link](http://a.b)');
});
