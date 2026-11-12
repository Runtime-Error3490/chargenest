/**
 * Agent permission policy (pure functions, no I/O).
 *
 * The owner grants an autonomy level (0-4) and may override single actions on or off.
 * - grantLevel: lowest level at which the action is allowed at all
 * - autoLevel:  lowest level at which the agent may run it without asking the owner
 * Allowed but below autoLevel means the owner must confirm first.
 */

export const AUTONOMY_LEVELS = {
  OFF: 0,
  INFORM: 1,
  ASK_FIRST: 2,
  ACT_AND_REPORT: 3,
  FULL: 4,
};

// Action ids match the toggles on the Agent Settings page.
export const AGENT_ACTIONS = {
  search_chargers: { grantLevel: 1, autoLevel: 1, spends: false },
  view_charger: { grantLevel: 1, autoLevel: 1, spends: false },
  compare_prices: { grantLevel: 1, autoLevel: 1, spends: false },
  view_payment: { grantLevel: 1, autoLevel: 1, spends: false },
  create_booking: { grantLevel: 2, autoLevel: 3, spends: true },
  modify_booking: { grantLevel: 2, autoLevel: 3, spends: false },
  cancel_booking: { grantLevel: 2, autoLevel: 3, spends: false },
  start_session: { grantLevel: 3, autoLevel: 3, spends: false },
  make_payment: { grantLevel: 2, autoLevel: 3, spends: true },
  // Only creates a PayPal link. The owner still pays on PayPal's page, so it is not a spend by the agent.
  top_up_wallet: { grantLevel: 2, autoLevel: 4, spends: false },
  // Bills another person. autoLevel above the top level (4) means the owner is always asked.
  create_invoice: { grantLevel: 3, autoLevel: 5, spends: false },
  request_refund: { grantLevel: 2, autoLevel: 4, spends: false },
  create_dispute: { grantLevel: 2, autoLevel: 4, spends: false },
  respond_dispute: { grantLevel: 2, autoLevel: 4, spends: false },
  accept_resolution: { grantLevel: 3, autoLevel: 4, spends: false },
};

// Each concierge tool maps to the permission actions it needs. Booking holds money, so it needs both.
export const TOOL_ACTIONS = {
  search_chargers: ['search_chargers'],
  find_place: ['search_chargers'],
  get_charger_details: ['view_charger'],
  estimate_cost: ['compare_prices'],
  create_booking: ['create_booking', 'make_payment'],
  raise_dispute: ['create_dispute'],
  get_wallet: ['view_payment'],
  cancel_booking: ['cancel_booking'],
  top_up_wallet: ['top_up_wallet'],
  recommend_chargers: ['search_chargers', 'compare_prices'],
  create_damage_invoice: ['create_invoice'],
  list_my_bookings: ['view_payment'],
  list_disputes: ['view_payment'],
  list_invoices: ['view_payment'],
  check_device_status: ['view_charger'],
};

// Who a tool is for. A tool not listed here is for everyone. A user with both roles gets both sets.
export const TOOL_ROLES = {
  search_chargers: ['driver'],
  get_charger_details: ['driver', 'host'],
  estimate_cost: ['driver'],
  create_booking: ['driver'],
  cancel_booking: ['driver'],
  top_up_wallet: ['driver'],
  recommend_chargers: ['driver'],
  raise_dispute: ['driver'],
  find_place: ['driver'],
  create_damage_invoice: ['host'],
};

export function toolAllowedForRoles(toolName, roles = []) {
  const wanted = TOOL_ROLES[toolName];
  return !wanted || wanted.some((r) => roles.includes(r));
}

export const DECISIONS = { ALLOW: 'allow', CONFIRM: 'confirm', DENY: 'deny' };

/**
 * Clamp raw stored/submitted settings into a safe shape.
 */
export function normalizeSettings(raw = {}, defaults = {}) {
  const level = Number.isInteger(raw.level) ? raw.level : (defaults.level ?? AUTONOMY_LEVELS.ASK_FIRST);
  const permissions = {};
  for (const [key, value] of Object.entries(raw.permissions || {})) {
    if (AGENT_ACTIONS[key] && typeof value === 'boolean') {
      permissions[key] = value;
    }
  }
  const limit = Number(raw.spendingLimit ?? defaults.spendingLimit ?? 0);
  return {
    level: Math.min(AUTONOMY_LEVELS.FULL, Math.max(AUTONOMY_LEVELS.OFF, level)),
    permissions,
    spendingLimit: Number.isFinite(limit) && limit > 0 ? limit : 0,
  };
}

/**
 * Decide whether an agent may run a tool now.
 *
 * @param {{level:number, permissions:Object, spendingLimit:number}} settings
 * @param {string} toolName
 * @param {{amount?:number, spentThisPeriod?:number}} ctx amount = money this call would commit
 * @returns {{decision:'allow'|'confirm'|'deny', reason:string, actions:string[]}}
 */
export function evaluateTool(settings, toolName, ctx = {}) {
  const actions = TOOL_ACTIONS[toolName];
  if (!actions) {
    return { decision: DECISIONS.DENY, reason: `Unknown tool: ${toolName}`, actions: [] };
  }

  const { level, permissions, spendingLimit } = normalizeSettings(settings);

  if (level === AUTONOMY_LEVELS.OFF) {
    return { decision: DECISIONS.DENY, reason: 'The agent is switched off (level 0)', actions };
  }

  let needsConfirm = false;
  let confirmReason = '';

  for (const id of actions) {
    const def = AGENT_ACTIONS[id];
    const override = permissions[id];

    if (override === false) {
      return { decision: DECISIONS.DENY, reason: `You turned off "${id}" for the agent`, actions };
    }
    if (override !== true && level < def.grantLevel) {
      return {
        decision: DECISIONS.DENY,
        reason: `"${id}" needs autonomy level ${def.grantLevel}+ (current level ${level})`,
        actions,
      };
    }
    if (level < def.autoLevel) {
      needsConfirm = true;
      confirmReason = confirmReason || `"${id}" needs your confirmation below level ${def.autoLevel}`;
    }
  }

  const amount = Number(ctx.amount) || 0;
  if (!needsConfirm && amount > 0) {
    const spent = Number(ctx.spentThisPeriod) || 0;
    if (spent + amount > spendingLimit) {
      needsConfirm = true;
      confirmReason = `Amount ${amount.toFixed(2)} would exceed your spending limit of ${spendingLimit.toFixed(2)} (already spent ${spent.toFixed(2)})`;
    }
  }

  return needsConfirm
    ? { decision: DECISIONS.CONFIRM, reason: confirmReason, actions }
    : { decision: DECISIONS.ALLOW, reason: 'Within the permissions you granted', actions };
}
