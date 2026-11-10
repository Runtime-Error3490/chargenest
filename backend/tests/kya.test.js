import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateIdentity,
  buildAttestation,
  signAttestation,
  verifyAttestation,
  canonicalize,
  hashArgs,
  encryptSecret,
  decryptSecret,
} from '../src/services/kya.service.js';

const sample = (overrides = {}) => buildAttestation({
  agentId: 'agent-1',
  ownerId: 'user-1',
  action: 'create_booking',
  args: { charger_id: 'c1', package_id: 'p1' },
  decision: 'allow',
  level: 3,
  at: new Date('2026-11-10T10:00:00Z'),
  ...overrides,
});

test('private keys are stored encrypted and round-trip', () => {
  const packed = encryptSecret('secret-key-material');
  assert.notEqual(packed, 'secret-key-material');
  assert.equal(decryptSecret(packed), 'secret-key-material');
  assert.throws(() => decryptSecret(packed, 'wrong-secret'));
});

test('an agent identity signs an action and the public key verifies it', () => {
  const { publicKey, privateKeyEnc } = generateIdentity();
  const payload = sample();
  const signature = signAttestation(privateKeyEnc, payload);
  assert.equal(verifyAttestation(publicKey, payload, signature), true);
});

test('changing any signed field breaks verification', () => {
  const { publicKey, privateKeyEnc } = generateIdentity();
  const payload = sample();
  const signature = signAttestation(privateKeyEnc, payload);

  for (const tampered of [
    { ...payload, ownerId: 'user-2' },
    { ...payload, decision: 'deny' },
    { ...payload, level: 4 },
    { ...payload, action: 'raise_dispute' },
    { ...payload, argsHash: hashArgs({ charger_id: 'other' }) },
  ]) {
    assert.equal(verifyAttestation(publicKey, tampered, signature), false);
  }
});

test('another agent cannot pass off its signature as this agent', () => {
  const a = generateIdentity();
  const b = generateIdentity();
  const payload = sample();
  const signatureFromB = signAttestation(b.privateKeyEnc, payload);
  assert.equal(verifyAttestation(a.publicKey, payload, signatureFromB), false);
});

test('garbage keys or signatures verify as false instead of throwing', () => {
  assert.equal(verifyAttestation('not-a-key', sample(), 'nope'), false);
});

test('canonical form ignores key order, so signatures are stable', () => {
  assert.equal(canonicalize({ b: 1, a: { d: 2, c: 3 } }), canonicalize({ a: { c: 3, d: 2 }, b: 1 }));
  assert.equal(hashArgs({ x: 1, y: 2 }), hashArgs({ y: 2, x: 1 }));
});

test('the attestation stores a hash of the arguments, not the arguments', () => {
  const payload = sample({ args: { secret: 'value' } });
  assert.equal(JSON.stringify(payload).includes('value'), false);
  assert.equal(payload.argsHash.length, 64);
});
