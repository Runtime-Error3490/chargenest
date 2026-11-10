import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTool, normalizeSettings, DECISIONS, AGENT_ACTIONS, TOOL_ACTIONS } from '../src/services/agentPolicy.js';

const settings = (level, permissions = {}, spendingLimit = 5000) => ({ level, permissions, spendingLimit });
const decide = (s, tool, ctx) => evaluateTool(s, tool, ctx).decision;

test('level 0 denies everything, even reads', () => {
  for (const tool of Object.keys(TOOL_ACTIONS)) {
    assert.equal(decide(settings(0), tool), DECISIONS.DENY, tool);
  }
});

test('level 1 (inform only) can discover but not book, pay or dispute', () => {
  assert.equal(decide(settings(1), 'search_chargers'), DECISIONS.ALLOW);
  assert.equal(decide(settings(1), 'get_charger_details'), DECISIONS.ALLOW);
  assert.equal(decide(settings(1), 'estimate_cost'), DECISIONS.ALLOW);
  assert.equal(decide(settings(1), 'create_booking'), DECISIONS.DENY);
  assert.equal(decide(settings(1), 'raise_dispute'), DECISIONS.DENY);
});

test('level 2 (ask first) needs confirmation for booking and disputes', () => {
  assert.equal(decide(settings(2), 'search_chargers'), DECISIONS.ALLOW);
  assert.equal(decide(settings(2), 'create_booking', { amount: 100 }), DECISIONS.CONFIRM);
  assert.equal(decide(settings(2), 'raise_dispute'), DECISIONS.CONFIRM);
});

test('level 3 books on its own inside the spending limit, confirms above it', () => {
  const s = settings(3, {}, 1000);
  assert.equal(decide(s, 'create_booking', { amount: 400, spentThisPeriod: 0 }), DECISIONS.ALLOW);
  assert.equal(decide(s, 'create_booking', { amount: 400, spentThisPeriod: 700 }), DECISIONS.CONFIRM);
  assert.match(evaluateTool(s, 'create_booking', { amount: 400, spentThisPeriod: 700 }).reason, /spending limit/);
});

test('level 3 still asks before raising a dispute, level 4 does not', () => {
  assert.equal(decide(settings(3), 'raise_dispute'), DECISIONS.CONFIRM);
  assert.equal(decide(settings(4), 'raise_dispute'), DECISIONS.ALLOW);
});

test('an action switched off by the owner is denied at any level', () => {
  const s = settings(4, { make_payment: false });
  const verdict = evaluateTool(s, 'create_booking', { amount: 100 });
  assert.equal(verdict.decision, DECISIONS.DENY);
  assert.match(verdict.reason, /make_payment/);
});

test('an action switched on explicitly is allowed below its grant level, but still needs confirmation', () => {
  const s = settings(1, { create_booking: true, make_payment: true });
  assert.equal(decide(s, 'create_booking', { amount: 100 }), DECISIONS.CONFIRM);
});

test('booking needs both create_booking and make_payment', () => {
  assert.deepEqual(TOOL_ACTIONS.create_booking, ['create_booking', 'make_payment']);
  assert.equal(decide(settings(4, { create_booking: false }), 'create_booking', { amount: 1 }), DECISIONS.DENY);
});

test('unknown tools are denied', () => {
  assert.equal(decide(settings(4), 'delete_everything'), DECISIONS.DENY);
});

test('every tool action exists in the action catalogue', () => {
  for (const actions of Object.values(TOOL_ACTIONS)) {
    for (const id of actions) assert.ok(AGENT_ACTIONS[id], id);
  }
});

test('normalizeSettings clamps the level and drops unknown or non-boolean permissions', () => {
  const clean = normalizeSettings({
    level: 99,
    permissions: { create_booking: true, nonsense: true, search_chargers: 'yes' },
    spendingLimit: -5,
  });
  assert.equal(clean.level, 4);
  assert.deepEqual(clean.permissions, { create_booking: true });
  assert.equal(clean.spendingLimit, 0);
});
